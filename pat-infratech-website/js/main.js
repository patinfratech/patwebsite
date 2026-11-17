// PAT Infratech site script: mobile menu, footer year, enquiry form.
(function () {
  var EMAIL = "patinfratechkas@gmail.com";

  var toggle = document.getElementById("nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // The form has no server behind it yet. It composes an email in the visitor's own mail app.
  // To collect enquiries directly, point this handler at a form service or your own backend.
  var form = document.getElementById("enquiry");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var note = document.getElementById("form-note");
      var v = function (id) { return document.getElementById(id).value.trim(); };
      if (!v("f-name") || !v("f-msg")) {
        note.textContent = "Please enter your name and a short description of the project.";
        note.className = "form-note error";
        (v("f-name") ? document.getElementById("f-msg") : document.getElementById("f-name")).focus();
        return;
      }
      var subject = "Project enquiry" + (v("f-type") ? ": " + v("f-type") : "") + " (" + v("f-name") + ")";
      var lines = [
        "Name: " + v("f-name"),
        v("f-org") && "Organisation: " + v("f-org"),
        v("f-phone") && "Phone: " + v("f-phone"),
        v("f-type") && "Project type: " + v("f-type"),
        v("f-loc") && "Location: " + v("f-loc")
      ].filter(Boolean).concat(["", v("f-msg")]);
      window.location.href = "mailto:" + EMAIL + "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(lines.join("\n"));
      note.textContent = "Your email app should now open with the message. If it does not, write to " + EMAIL + ".";
      note.className = "form-note";
    });
  }
})();
