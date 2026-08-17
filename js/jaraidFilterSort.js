/*
 * jaraidFilterSort.js
 * ---------------------------------------------------------------
 * Adds client-side filtering (year range, place of publication,
 * language, holding institution) and click-to-sort columns to the
 * big chronology table (<tei-table id="t1"> -> <table>) used on
 * pages/chrono.html and pages/fihris.html.
 *
 * Design notes:
 * - No build step, no external dependencies. Works with the table
 *   exactly as CETEIcean/the "table" behavior in behaviors.js
 *   already renders it (real <tr>/<td> elements with an "n"
 *   attribute marking the original TEI cell number, and a
 *   "thedate" attribute on the date cells holding an ISO-ish
 *   year or yyyy-mm-dd string).
 * - Filtering never removes rows from the DOM; it just toggles
 *   row.style.display. This keeps memory/DOM state simple and
 *   makes "reset" instant.
 * - Sorting re-appends <tr> elements inside the same <table> in
 *   the requested order, using a DocumentFragment for a single
 *   reflow instead of one per row.
 * - The column layout (n=1..12) is documented in the table's own
 *   header row:
 *     1 Year of first issue   7  Comments
 *     2 Day/month of first    8  Source
 *     3 Date of last issue    9  Holdings
 *     4 Title                 10 Arabic title
 *     5 Place of publication  11 Arabic editor/publisher
 *     6 Owners/publishers     12 Arabic place
 * ---------------------------------------------------------------
 */
(function () {
      "use strict";

   var LANGUAGES = [
           "Arabic",
           "English",
           "French",
           "German",
           "Italian",
           "Ottoman Turkish",
           "Turkish",
           "Persian",
           "Judeo-Arabic",
           "Armenian",
           "Hebrew",
           "Greek"
         ];

   // UI strings: Arabic on the Arabic chronology page (pages/fihris.html,
   // <body id="fihris">), English everywhere else (pages/chrono.html).
   var IS_ARABIC_PAGE = !!(document.body && document.body.id === "fihris");
   var ARABIC_LANG_NAMES = {
           "Arabic": "العربية",
           "English": "الإنجليزية",
           "French": "الفرنسية",
           "German": "الألمانية",
           "Italian": "الإيطالية",
           "Ottoman Turkish": "التركية العثمانية",
           "Turkish": "التركية",
           "Persian": "الفارسية",
           "Judeo-Arabic": "العربية اليهودية",
           "Armenian": "الأرمنية",
           "Hebrew": "العبرية",
           "Greek": "اليونانية"
   };
   var STR = IS_ARABIC_PAGE ? {
           jumpToYear: "الانتقال إلى سنة",
           search: "بحث",
           searchPlaceholder: "العنوان، المكان، الناشر، ملاحظات...",
           yearFrom: "من سنة",
           yearTo: "إلى سنة",
           placeOfPub: "مكان النشر",
           placeExample: "مثال: القاهرة",
           holdingInst: "المؤسسة الحافظة",
           any: "الكل",
           language: "اللغة",
           expandAll: "توسيع كل الصفوف",
           collapseAll: "طي كل الصفوف",
           resetFilters: "إعادة تعيين عوامل التصفية",
           sortHint: "انقر على عنوان العمود للترتيب.",
           showFull: "عرض السجل الكامل (الملاك، الملاحظات، المصدر، المقتنيات)",
           showSummary: "عرض الملخص فقط",
           showingOf: function (visible, total) {
                     return "عرض " + visible + " من " + total + " سجل";
           },
           langName: function (l) { return ARABIC_LANG_NAMES[l] || l; }
   } : {
           jumpToYear: "Jump to year",
           search: "Search",
           searchPlaceholder: "Title, place, editor, comments...",
           yearFrom: "Year from",
           yearTo: "Year to",
           placeOfPub: "Place of publication",
           placeExample: "e.g. Cairo",
           holdingInst: "Holding institution",
           any: "Any",
           language: "Language",
           expandAll: "Expand all rows",
           collapseAll: "Collapse all rows",
           resetFilters: "Reset filters",
           sortHint: "Click a column heading to sort.",
           showFull: "Show full entry (owners, comments, source, holdings)",
           showSummary: "Show summary only",
           showingOf: function (visible, total) {
                     return "Showing " + visible + " of " + total + " entries";
           },
           langName: function (l) { return l; }
   };

   function normalize(str) {
           if (!str) return "";
           return str
             .normalize("NFD")
             .replace(/[̀-ͯ]/g, "") // strip diacritics for matching
          .toLowerCase()
             .trim();
   }

   function cellText(tr, n) {
           var td = tr.querySelector('td[n="' + n + '"]');
           return td ? td.textContent.replace(/\s+/g, " ").trim() : "";
   }

   function cellEl(tr, n) {
           return tr.querySelector('td[n="' + n + '"]');
   }

   function parseYear(thedate) {
           if (!thedate) return null;
           var m = thedate.match(/-?\d{3,4}/);
           return m ? parseInt(m[0], 10) : null;
   }

   function debounce(fn, wait) {
           var t;
           return function () {
                     var args = arguments;
                     clearTimeout(t);
                     t = setTimeout(function () {
                                 fn.apply(null, args);
                     }, wait);
           };
   }

   function init() {
           var wrapper = document.getElementById("t1");
           if (!wrapper) return; // not a page with the chronology table
        var table = wrapper.querySelector("table");
           if (!table) return;

             // Wrap the real <table> in its own horizontally-scrollable box so a
             // very wide table (many columns) never forces the whole page to
             // scroll sideways on a phone; only the table itself scrolls, while
             // the toolbar above stays full-width and fully reachable.
             if (!table.parentNode.classList || !table.parentNode.classList.contains("jaraid-table-scroll")) {
                         var scrollBox = document.createElement("div");
                         scrollBox.className = "jaraid-table-scroll";
                         table.parentNode.insertBefore(scrollBox, table);
                         scrollBox.appendChild(table);
             }

        var allRows = Array.prototype.slice.call(table.querySelectorAll("tr"));
                    if (allRows.length < 2) return;
         
                 var headerRow = allRows[0];
                    var dataRows = allRows.slice(1);
         
         // ---- Build an in-memory index for each row (computed once) ----
        var index = dataRows.map(function (tr) {
                  var holdingsEl = cellEl(tr, "9");
                  var holdingCodes = [];
                  if (holdingsEl) {
                              Array.prototype.forEach.call(
                                            holdingsEl.querySelectorAll('[data-origname="rs"]'),
                                            function (rs) {
                                                            var ref = rs.getAttribute("ref") || "";
                                                            ref = ref.replace(/^#h?/, "").toUpperCase();
                                                            if (ref) holdingCodes.push(ref);
                                            }
                                          );
                  }
                  var yearCell = cellEl(tr, "1");
                  var lastCell = cellEl(tr, "3");
                  var commentsText = cellText(tr, "7");
                  var ownersText = cellText(tr, "6");
                  var titleText = cellText(tr, "4") || cellText(tr, "10");
                  var placeText = cellText(tr, "5") || cellText(tr, "12");

                                       var langHay = normalize(commentsText + " " + ownersText);
                  var langs = LANGUAGES.filter(function (l) {
                              return langHay.indexOf(normalize(l)) !== -1;
                  });

                                       return {
                                                   el: tr,
                                                   year: parseYear(yearCell && yearCell.getAttribute("thedate")),
                                                   endYear: parseYear(lastCell && lastCell.getAttribute("thedate")),
                                                   title: titleText,
                                                   place: placeText,
                                                   placeNorm: normalize(placeText),
                                                   owners: ownersText,
                                                   holdingCodes: holdingCodes,
                                                   langs: langs,
                                                   searchBlob: normalize(
                                                                 [titleText, placeText, ownersText, commentsText].join(" ")
                                                               )
                                       };
        });

        var years = index.map(function (r) { return r.year; }).filter(function (y) { return y !== null; });
           var minYear = years.length ? Math.min.apply(null, years) : 1800;
           var maxYear = years.length ? Math.max.apply(null, years) : 1929;

        var placeSet = {};
           index.forEach(function (r) { if (r.place) placeSet[r.place] = true; });
           var places = Object.keys(placeSet).sort(function (a, b) { return a.localeCompare(b); });

        var holdingSet = {};
           index.forEach(function (r) { r.holdingCodes.forEach(function (c) { holdingSet[c] = true; }); });
           var holdings = Object.keys(holdingSet).sort();

        // ---- Build the filter/sort toolbar UI ----
        var panel = document.createElement("div");
           panel.id = "jaraidToolbar";
           panel.setAttribute("role", "search");
           panel.innerHTML =
                     '<div class="jaraid-row jaraid-decades-row">' +
                       '<span class="jaraid-decades-label">' + STR.jumpToYear + "</span>" +
                       '<div id="jaraidDecades" class="jaraid-decades"></div>' +
                     "</div>" +
                     '<div class="jaraid-row">' +
                       '<div class="jaraid-field jaraid-field-search">' +
                         '<label for="jaraidSearch">' + STR.search + "</label>" +
                         '<input type="text" id="jaraidSearch" placeholder="' + STR.searchPlaceholder + '">' +
                       "</div>" +
                       '<div class="jaraid-field">' +
                         '<label for="jaraidYearMin">' + STR.yearFrom + "</label>" +
                         '<input type="number" id="jaraidYearMin" min="' + minYear + '" max="' + maxYear + '" placeholder="' + minYear + '">' +
                       "</div>" +
                       '<div class="jaraid-field">' +
                         '<label for="jaraidYearMax">' + STR.yearTo + "</label>" +
                         '<input type="number" id="jaraidYearMax" min="' + minYear + '" max="' + maxYear + '" placeholder="' + maxYear + '">' +
                       "</div>" +
                     "</div>" +
                     '<div class="jaraid-row">' +
                       '<div class="jaraid-field">' +
                         '<label for="jaraidPlace">' + STR.placeOfPub + "</label>" +
                         '<input type="text" id="jaraidPlace" list="jaraidPlaceList" placeholder="' + STR.placeExample + '">' +
                         '<datalist id="jaraidPlaceList">' +
                           places.map(function (p) { return '<option value="' + p.replace(/"/g, "&quot;") + '">'; }).join("") +
                         "</datalist>" +
                       "</div>" +
                       '<div class="jaraid-field">' +
                         '<label for="jaraidHolding">' + STR.holdingInst + "</label>" +
                         '<select id="jaraidHolding">' +
                           '<option value="">' + STR.any + "</option>" +
                           holdings.map(function (h) { return '<option value="' + h + '">' + h + "</option>"; }).join("") +
                         "</select>" +
                       "</div>" +
                       '<div class="jaraid-field jaraid-field-lang">' +
                         '<details id="jaraidLangDetails">' +
                           '<summary>' + STR.language + ' <span id="jaraidLangCount"></span></summary>' +
                           '<div class="jaraid-lang-list">' +
                             LANGUAGES.map(function (l, i) {
                                                 return '<label><input type="checkbox" class="jaraid-lang-cb" value="' + l + '"> ' + STR.langName(l) + "</label>";
                             }).join("") +
                           "</div>" +
                         "</details>" +
                       "</div>" +
                       '<div class="jaraid-field jaraid-field-reset">' +
                         '<button type="button" id="jaraidReset" class="jaraid-btn">' + STR.resetFilters + "</button>" +
                       "</div>" +
                     "</div>" +
                     '<div class="jaraid-row jaraid-status">' +
                       '<span id="jaraidCount"></span>' +
                       '<span class="jaraid-hint">' + STR.sortHint + "</span>" +
                     "</div>";

        // ---- Expand/Collapse-all controls: a separate, more prominent ----
        // bar placed between the page's nav menu and the filter/search
        // panel (rather than buried among the filter fields), so the
        // most commonly used row-display toggle is easy to find.
        var rowControls = document.createElement("div");
           rowControls.id = "jaraidRowControls";
           rowControls.innerHTML =
                     '<button type="button" id="jaraidExpandAll" class="jaraid-btn-prominent">' +
                       '<span class="jaraid-btn-icon" aria-hidden="true">+</span>' + STR.expandAll +
                     "</button>" +
                     '<button type="button" id="jaraidCollapseAll" class="jaraid-btn-prominent">' +
                       '<span class="jaraid-btn-icon" aria-hidden="true">−</span>' + STR.collapseAll +
                     "</button>";

        wrapper.parentNode.insertBefore(rowControls, wrapper);
        wrapper.parentNode.insertBefore(panel, wrapper);

        // ---- Fold the old fixed decade sidebar into the toolbar ----
        // The page ships a fixed-position ".sidenav" with decade-jump
        // links (e.g. <a href="#t1r157">1880</a>) that used to float over
        // the left edge of the page and got covered by the new sticky
        // toolbar. Instead of duplicating those links, move the real
        // anchor elements into the toolbar so existing hrefs/behavior are
        // preserved, then remove the now-empty old sidebar.
        var decadesRow = panel.querySelector(".jaraid-decades-row");
           var decadesContainer = document.getElementById("jaraidDecades");
           var oldNav = document.querySelector(".sidenav");
           if (oldNav && decadesContainer) {
                     var navLinks = Array.prototype.slice.call(oldNav.querySelectorAll("a"));
                     navLinks.forEach(function (a) {
                                 a.classList.add("jaraid-decade-link");
                                 decadesContainer.appendChild(a);
                     });
                     if (oldNav.parentNode) oldNav.parentNode.removeChild(oldNav);
           } else if (decadesRow && decadesRow.parentNode) {
                     // No old sidebar found (or nothing to move) — don't show an
             // empty "Jump to year" row.
             decadesRow.parentNode.removeChild(decadesRow);
           }

        // ---- Collapsible rows: show title/place/date by default, ----
             // ---- expand a row to reveal owners, comments, source, holdings ----
             // Cells with no counterpart in the compact view (day/month, owners,
             // comments, source, holdings). Year, last-issue date, title and
             // place (English or Arabic, whichever the page shows) stay visible
             // at all times so the row is still identifiable when collapsed.
             var COLLAPSIBLE_CELLS = ["2", "6", "7", "8", "9"];
         
             function setRowCollapsed(row, collapsed) {
                         COLLAPSIBLE_CELLS.forEach(function (n) {
                                       var td = cellEl(row.el, n);
                                       if (td) td.style.display = collapsed ? "none" : "";
                         });
                         row.collapsed = collapsed;
                         if (row.toggleEl) {
                                       row.toggleEl.textContent = collapsed ? "+" : "-";
                                       row.toggleEl.setAttribute("aria-expanded", collapsed ? "false" : "true");
                                       row.toggleEl.setAttribute(
                                                       "title",
                                                       collapsed ? STR.showFull : STR.showSummary
                                                     );
                         }
             }
         
             index.forEach(function (row) {
                         var anchorCell = cellEl(row.el, "1");
                         if (!anchorCell) return;
                         var toggle = document.createElement("span");
                         toggle.className = "jaraid-row-toggle";
                         toggle.setAttribute("role", "button");
                         toggle.setAttribute("tabindex", "0");
                         toggle.addEventListener("click", function (e) {
                                       e.stopPropagation();
                                       setRowCollapsed(row, !row.collapsed);
                         });
                         toggle.addEventListener("keydown", function (e) {
                                       if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
                                                       e.preventDefault();
                                                       setRowCollapsed(row, !row.collapsed);
                                       }
                         });
                         anchorCell.insertBefore(toggle, anchorCell.firstChild);
                         row.toggleEl = toggle;
                         setRowCollapsed(row, true);
             });
         
             var $expandAll = document.getElementById("jaraidExpandAll");
             var $collapseAll = document.getElementById("jaraidCollapseAll");
             $expandAll.addEventListener("click", function () {
                         index.forEach(function (row) { setRowCollapsed(row, false); });
             });
             $collapseAll.addEventListener("click", function () {
                         index.forEach(function (row) { setRowCollapsed(row, true); });
             });
         
             // ---- Wire up header cells for click-to-sort ----
        var headerCells = Array.prototype.slice.call(headerRow.querySelectorAll("td"));
           var sortState = { n: null, dir: 1 };

        headerCells.forEach(function (td) {
                  td.classList.add("jaraid-sortable");
                  td.addEventListener("click", function () {
                              var n = td.getAttribute("n");
                              if (sortState.n === n) {
                                            sortState.dir *= -1;
                              } else {
                                            sortState.n = n;
                                            sortState.dir = 1;
                              }
                              headerCells.forEach(function (h) { h.classList.remove("jaraid-sort-asc", "jaraid-sort-desc"); });
                              td.classList.add(sortState.dir === 1 ? "jaraid-sort-asc" : "jaraid-sort-desc");
                              applySort();
                  });
        });

        function applySort() {
                  if (!sortState.n) return;
                  var n = sortState.n;
                  var dir = sortState.dir;
                  var sorted = index.slice().sort(function (a, b) {
                              var av, bv;
                              if (n === "1") {
                                            av = a.year === null ? -Infinity : a.year;
                                            bv = b.year === null ? -Infinity : b.year;
                              } else if (n === "3") {
                                            av = a.endYear === null ? -Infinity : a.endYear;
                                            bv = b.endYear === null ? -Infinity : b.endYear;
                              } else {
                                            av = normalize(cellText(a.el, n));
                                            bv = normalize(cellText(b.el, n));
                              }
                              if (av < bv) return -1 * dir;
                              if (av > bv) return 1 * dir;
                              return 0;
                  });
                  var frag = document.createDocumentFragment();
                  sorted.forEach(function (r) { frag.appendChild(r.el); });
                  table.appendChild(frag);
        }

        // ---- Filtering ----
        var $search = document.getElementById("jaraidSearch");
           var $yearMin = document.getElementById("jaraidYearMin");
           var $yearMax = document.getElementById("jaraidYearMax");
           var $place = document.getElementById("jaraidPlace");
           var $holding = document.getElementById("jaraidHolding");
           var $reset = document.getElementById("jaraidReset");
           var $count = document.getElementById("jaraidCount");
           var $langCount = document.getElementById("jaraidLangCount");
           var $langBoxes = Array.prototype.slice.call(document.querySelectorAll(".jaraid-lang-cb"));

        function selectedLangs() {
                  return $langBoxes.filter(function (cb) { return cb.checked; }).map(function (cb) { return cb.value; });
        }

        function applyFilters() {
                  var q = normalize($search.value);
                  var yMin = $yearMin.value ? parseInt($yearMin.value, 10) : null;
                  var yMax = $yearMax.value ? parseInt($yearMax.value, 10) : null;
                  var placeQ = normalize($place.value);
                  var holdingQ = $holding.value;
                  var langs = selectedLangs();

             $langCount.textContent = langs.length ? "(" + langs.length + ")" : "";

             var visible = 0;
                  index.forEach(function (r) {
                              var ok = true;

                                        if (q && r.searchBlob.indexOf(q) === -1) ok = false;

                                        if (ok && (yMin !== null || yMax !== null)) {
                                                      var y1 = r.year;
                                                      var y2 = r.endYear !== null ? r.endYear : r.year;
                                                      if (y1 === null && y2 === null) {
                                                                      ok = false;
                                                      } else {
                                                                      var lo = y1 !== null ? y1 : y2;
                                                                      var hi = y2 !== null ? y2 : y1;
                                                                      if (yMin !== null && hi < yMin) ok = false;
                                                                      if (yMax !== null && lo > yMax) ok = false;
                                                      }
                                        }

                                        if (ok && placeQ && r.placeNorm.indexOf(placeQ) === -1) ok = false;

                                        if (ok && holdingQ && r.holdingCodes.indexOf(holdingQ) === -1) ok = false;

                                        if (ok && langs.length && !langs.some(function (l) { return r.langs.indexOf(l) !== -1; })) ok = false;

                                        r.el.style.display = ok ? "" : "none";
                              if (ok) visible++;
                  });

             $count.textContent = STR.showingOf(visible, index.length);
        }

        var debouncedApply = debounce(applyFilters, 120);

        $search.addEventListener("input", debouncedApply);
           $yearMin.addEventListener("input", debouncedApply);
           $yearMax.addEventListener("input", debouncedApply);
           $place.addEventListener("input", debouncedApply);
           $holding.addEventListener("change", applyFilters);
           $langBoxes.forEach(function (cb) { cb.addEventListener("change", applyFilters); });

        $reset.addEventListener("click", function () {
                  $search.value = "";
                  $yearMin.value = "";
                  $yearMax.value = "";
                  $place.value = "";
                  $holding.value = "";
                  $langBoxes.forEach(function (cb) { cb.checked = false; });
                  applyFilters();
        });

        // ---- Keep the toolbar (and, below it, the header row) pinned ----
        function updateStickyOffsets() {
                  var h = panel.offsetHeight;
                  headerRow.style.top = h + "px";
        }
           window.addEventListener("resize", debounce(updateStickyOffsets, 150));
           updateStickyOffsets();

        applyFilters();
   }

   if (document.readyState === "loading") {
           document.addEventListener("DOMContentLoaded", init);
   } else {
           init();
   }
})();
