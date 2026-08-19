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
   // NOTE: IS_ARABIC_PAGE/STR are computed inside init() (not here at
   // module load time) because this script is loaded from <head> and
   // runs before <body> exists in the DOM — checking document.body.id
   // at the top level always saw body === null and silently fell back
   // to the English strings, even on pages/fihris.html.
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
           // Computed here (not at module load time) so document.body
           // and its id are reliably available — see note above.
           var IS_ARABIC_PAGE = !!(document.body && document.body.id === "fihris");
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
                     resetFilters: "إعادة تعيين عوامل التصفية",
                     sortHint: "انقر على أي صف لعرض السجل الكامل.",
                     viewDetails: "عرض السجل الكامل",
                     closeModal: "إغلاق",
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
                     resetFilters: "Reset filters",
                     sortHint: "Click any row to view the full entry.",
                     viewDetails: "View full entry",
                     closeModal: "Close",
                     showingOf: function (visible, total) {
                               return "Showing " + visible + " of " + total + " entries";
                     },
                     langName: function (l) { return l; }
           };

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
                  // On the Arabic page (fihris.html), prefer each row's
                  // Arabic-script title/place (n=10/12) over its English
                  // one (n=4/5) -- previously this always tried English
                  // first, so the "Place of publication" search field's
                  // autocomplete list (built from these place values just
                  // below) surfaced Latin-script city names like "Cairo"
                  // even on the Arabic page, since most rows have an
                  // English place filled in even when it isn't displayed
                  // there. Search text matching (searchBlob below) uses
                  // the same value, so this also makes free-text search
                  // match against the Arabic place/title on that page.
                  var titleText = IS_ARABIC_PAGE
                            ? (cellText(tr, "10") || cellText(tr, "4"))
                            : (cellText(tr, "4") || cellText(tr, "10"));
                  var placeText = IS_ARABIC_PAGE
                            ? (cellText(tr, "12") || cellText(tr, "5"))
                            : (cellText(tr, "5") || cellText(tr, "12"));

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

        // ---- Row detail modal ----
        // Clicking a row (or its small view-details button) opens a modal
        // listing every non-empty field for that entry, each labeled with
        // that column's own header text (so it reads correctly in either
        // language without hand-translated labels). This replaces the old
        // per-row +/- inline expand: clicking through 3000+ rows one at a
        // time to peek at a single field was slow, and each expand/collapse
        // reflowed the list around it. A modal keeps the list itself
        // static and scannable while still surfacing the full record
        // (day/month, owners, comments, source, holdings, Arabic fields,
        // etc.) on demand, and works the same way on mobile and desktop.
        var ALL_COLUMNS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

        var FIELD_LABEL = {};
        ALL_COLUMNS.forEach(function (n) {
                  FIELD_LABEL[n] = cellText(headerRow, n);
        });

        var modalOverlay = document.createElement("div");
        modalOverlay.id = "jaraidModal";
        modalOverlay.className = "jaraid-modal-overlay";
        modalOverlay.hidden = true;
        modalOverlay.innerHTML =
                  '<div class="jaraid-modal" role="dialog" aria-modal="true">' +
                    '<button type="button" class="jaraid-modal-close" aria-label="' + STR.closeModal + '">×</button>' +
                    '<div class="jaraid-modal-body"></div>' +
                  "</div>";
        document.body.appendChild(modalOverlay);

        var $modalBody = modalOverlay.querySelector(".jaraid-modal-body");
        var $modalClose = modalOverlay.querySelector(".jaraid-modal-close");
        var lastTrigger = null;

        // The Year cell (n=1) carries the "view details" button as its
        // first child (see below) -- strip it out of a clone before
        // reusing that cell's markup inside the modal, so the "›" icon
        // doesn't end up embedded in the displayed value.
        function cellHtml(td) {
                  var clone = td.cloneNode(true);
                  var btn = clone.querySelector(".jaraid-row-view-btn");
                  if (btn) btn.parentNode.removeChild(btn);
                  return clone.innerHTML;
        }

        function openModal(row) {
                  var headingN = null;
                  if (cellText(row.el, "4")) headingN = "4";
                  else if (cellText(row.el, "10")) headingN = "10";

                  var html = "";
                  if (headingN) {
                            html += '<h2 class="jaraid-modal-title">' + cellHtml(cellEl(row.el, headingN)) + "</h2>";
                  }
                  ALL_COLUMNS.forEach(function (n) {
                            if (n === headingN) return;
                            var td = cellEl(row.el, n);
                            if (!td || !cellText(row.el, n)) return;
                            html +=
                                      '<div class="jaraid-modal-field">' +
                                        '<span class="jaraid-field-label">' + (FIELD_LABEL[n] || "") + "</span>" +
                                        '<div class="jaraid-modal-value">' + cellHtml(td) + "</div>" +
                                      "</div>";
                  });
                  $modalBody.innerHTML = html;
                  modalOverlay.hidden = false;
                  $modalClose.focus();
        }

        function closeModal() {
                  modalOverlay.hidden = true;
                  if (lastTrigger) lastTrigger.focus();
        }

        $modalClose.addEventListener("click", closeModal);
        modalOverlay.addEventListener("click", function (e) {
                  if (e.target === modalOverlay) closeModal();
        });
        document.addEventListener("keydown", function (e) {
                  if (e.key === "Escape" && !modalOverlay.hidden) closeModal();
        });

        // The title cell (whichever of n=4 English / n=10 Arabic is the
        // one actually populated on this page) carries a trailing
        // " ID:t1r123" text node after two <br>s, straight from the TEI
        // source. Left in place it forces every compact row onto two
        // lines for a fragment that's really reference metadata, not
        // part of the title -- wrap it in a span so it can be hidden
        // from the row (CSS below, scoped so it still shows inside the
        // modal, which clones this same cell).
        function tagIdSuffix(td) {
                  if (!td) return;
                  var nodes = Array.prototype.slice.call(td.childNodes);
                  for (var i = nodes.length - 1; i >= 0; i--) {
                            var node = nodes[i];
                            if (node.nodeType === 3 && /^\s*ID\s*:/.test(node.textContent)) {
                                          var span = document.createElement("span");
                                          span.className = "jaraid-id-tag";
                                          td.insertBefore(span, node);
                                          var toMove = [node];
                                          var prev = node.previousSibling;
                                          while (prev && prev.tagName === "BR") {
                                                            toMove.unshift(prev);
                                                            prev = prev.previousSibling;
                                          }
                                          toMove.forEach(function (n) { span.appendChild(n); });
                                          return;
                            }
                  }
        }

        tagIdSuffix(cellEl(headerRow, "4"));
        tagIdSuffix(cellEl(headerRow, "10"));

        index.forEach(function (row) {
                  tagIdSuffix(cellEl(row.el, "4"));
                  tagIdSuffix(cellEl(row.el, "10"));

                  var anchorCell = cellEl(row.el, "1");
                  if (!anchorCell) return;
                  var viewBtn = document.createElement("button");
                  viewBtn.type = "button";
                  viewBtn.className = "jaraid-row-view-btn";
                  viewBtn.setAttribute("aria-label", STR.viewDetails);
                  viewBtn.textContent = "›";
                  viewBtn.addEventListener("click", function (e) {
                            e.stopPropagation();
                            lastTrigger = viewBtn;
                            openModal(row);
                  });
                  anchorCell.insertBefore(viewBtn, anchorCell.firstChild);

                  row.el.addEventListener("click", function (e) {
                            if (e.target.closest("a")) return;
                            lastTrigger = viewBtn;
                            openModal(row);
                  });
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
