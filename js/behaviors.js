var behaviors = {
  "tei": {
    "rs": function (rs) {
      let tooltip = document.createElement("span");
      tooltip.setAttribute("class", "tip");
      let expan = document.querySelector(rs.getAttribute("ref") + " tei-expan");
      if (expan) {
        tooltip.innerHTML = expan.innerHTML;
      } else {
        console.log("Can't find " + rs.getAttribute("ref"));
      }
      rs.appendChild(tooltip);
    },
    "table": function(elt) {
      let table = document.createElement("table");
      table.innerHTML = elt.innerHTML;
      if (table.firstElementChild.localName == "tei-head") {
        let head = table.firstElementChild;
        head.remove();
        let caption = document.createElement("caption");
        caption.innerHTML = head.innerHTML;
        table.appendChild(caption);
      }
      for (let row of Array.from(table.querySelectorAll("tei-row"))) {
        let tr = document.createElement("tr");
        tr.innerHTML = row.innerHTML;
        for (let attr of Array.from(row.attributes)) {
          tr.setAttribute(attr.name, attr.value);
        }
        row.parentElement.replaceChild(tr, row);
      }
      for (let cell of Array.from(table.querySelectorAll("tei-cell"))) {
        let td = document.createElement("td");
        if (cell.hasAttribute("cols")) {
          td.setAttribute("colspan", cell.getAttribute("cols"));
        }
        td.innerHTML = cell.innerHTML;
        for (let attr of Array.from(cell.attributes)) {
          td.setAttribute(attr.name, attr.value);
        }
        cell.parentElement.replaceChild(td, cell);
      }
      this.hideContent(elt, true);
      elt.appendChild(table);
    }
  }
}
