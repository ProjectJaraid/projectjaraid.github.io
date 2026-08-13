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
                 '<div class="jaraid-row">' +
                   '<div class="jaraid-field jaraid-field-search">' +
                     '<label for="jaraidSearch">Search</label>' +
                     '<input type="text" id="jaraidSearch" placeholder="Title, place, editor, comments...">' +
                   "</div>" +
                   '<div class="jaraid-field">' +
                     '<label for="jaraidYearMin">Year from</label>' +
                     '<input type="number" id="jaraidYearMin" min="' + minYear + '" max="' + maxYear + '" placeholder="' + minYear + '">' +
                   "</div>" +
                   '<div class="jaraid-field">' +
                     '<label for="jaraidYearMax">Year to</label>' +
                     '<input type="number" id="jaraidYearMax" min="' + minYear + '" max="' + maxYear + '" placeholder="' + maxYear + '">' +
                   "</div>" +
                 "</div>" +
                 '<div class="jaraid-row">' +
                   '<div class="jaraid-field">' +
                     '<label for="jaraidPlace">Place of publication</label>' +
                     '<input type="text" id="jaraidPlace" list="jaraidPlaceList" placeholder="e.g. Cairo">' +
                     '<datalist id="jaraidPlaceList">' +
                       places.map(function (p) { return '<option value="' + p.replace(/"/g, "&quot;") + '">'; }).join("") +
                     "</datalist>" +
                   "</div>" +
                   '<div class="jaraid-field">' +
                     '<label for="jaraidHolding">Holding institution</label>' +
                     '<select id="jaraidHolding">' +
                       '<option value="">Any</option>' +
                       holdings.map(function (h) { return '<option value="' + h + '">' + h + "</option>"; }).join("") +
                     "</select>" +
                   "</div>" +
                   '<div class="jaraid-field jaraid-field-lang">' +
                     '<details id="jaraidLangDetails">' +
                       '<summary>Language <span id="jaraidLangCount"></span></summary>' +
                       '<div class="jaraid-lang-list">' +
                         LANGUAGES.map(function (l, i) {
                                           return '<label><input type="checkbox" class="jaraid-lang-cb" value="' + l + '"> ' + l + "</label>";
                         }).join("") +
                       "</div>" +
                     "</details>" +
                   "</div>" +
                   '<div class="jaraid-field jaraid-field-reset">' +
                     '<button type="button" id="jaraidReset">Reset filters</button>' +
                   "</div>" +
                 "</div>" +
                 '<div class="jaraid-row jaraid-status">' +
                   '<span id="jaraidCount"></span>' +
                   '<span class="jaraid-hint">Click a column heading to sort.</span>' +
                 "</div>";

      wrapper.parentNode.insertBefore(panel, wrapper);

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

           $count.textContent = "Showing " + visible + " of " + index.length + " entries";
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
