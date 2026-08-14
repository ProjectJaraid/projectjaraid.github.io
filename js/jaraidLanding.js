/*
 * jaraidLanding.js
 * ------------------------------------------------------------------
 * Landing-page (index.html) polish. index.html fetches the full TEI
 * master file client-side via CETEIcean, then appends the transformed
 * content to <body>. By default this puts the entire academic
 * introduction (Introductory Notes, Version History, Transliteration,
 * Period, Definition, Availability, Future, Reference - all children
 * of the <tei-front id="dFront"> element) directly in the reader's
 * way, above any link to the actual chronology.
 *
 * This script collapses that long-form introduction into a single
 * <details> element (closed by default) once the CETEIcean content
 * has been appended to the page. It does not touch the TEI/XSLT
 * pipeline or remove any content - everything is still there, one
 * click away.
 *
 * index.html calls window.jaraidLandingEnhance() itself, right after
 * appending the CETEIcean-transformed data to <body>.
 */
(function () {
    "use strict";

   var LONG_SECTION_IDS = [
         "dIntro",
         "dVersionHist",
         "dTrans",
         "dPer",
         "dDef",
         "dAvail",
         "dFut",
         "dRef"
       ];

   function collapseLongIntro() {
         if (document.getElementById("jaraidIntroDetails")) return; // already done

      var first = document.getElementById(LONG_SECTION_IDS[0]);
         if (!first || !first.parentNode) return;

      var details = document.createElement("details");
         details.id = "jaraidIntroDetails";

      var summary = document.createElement("summary");
         summary.textContent = "Read the full introduction, methodology, and version history";
         details.appendChild(summary);

      first.parentNode.insertBefore(details, first);

      LONG_SECTION_IDS.forEach(function (id) {
              var el = document.getElementById(id);
              if (el) details.appendChild(el);
      });
   }

   window.jaraidLandingEnhance = function () {
         collapseLongIntro();
   };
})();
