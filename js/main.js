/* PAT Infratech site script. No dependencies, no build step.
   Everything here is an enhancement: every page reads and works without it.
   Each behaviour does nothing when its elements are not on the page. */
(function () {
  "use strict";

  // ---- Owner settings ---------------------------------------------------
  const EMAIL = "patinfratechkas@gmail.com";
  // WhatsApp number in international form, digits only (for example "91" + 10-digit mobile).
  // Leave empty to keep every WhatsApp button off.
  const WHATSAPP_NUMBER = "";
  // Phone number for a Call button in the mobile header. Leave empty for no Call button.
  const PHONE_NUMBER = "";
  // -----------------------------------------------------------------------

  const root = document.documentElement;
  root.classList.add("js");

  const reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const $$ = (sel, scope) => Array.prototype.slice.call((scope || document).querySelectorAll(sel));
  const EASE = "cubic-bezier(.2,.7,.2,1)";

  // ---- Mobile navigation ------------------------------------------------
  function initNav() {
    const toggle = document.getElementById("nav-toggle");
    const nav = document.getElementById("site-nav");
    if (!toggle || !nav) return;
    const isOpen = () => toggle.getAttribute("aria-expanded") === "true";
    function setOpen(open, returnFocus) {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (!open && returnFocus) toggle.focus();
    }
    toggle.addEventListener("click", function () { setOpen(!isOpen()); });
    document.addEventListener("keydown", function (e) {
      if ((e.key === "Escape" || e.key === "Esc") && isOpen()) {
        setOpen(false, nav.contains(document.activeElement) || document.activeElement === toggle);
      }
    });
    document.addEventListener("click", function (e) {
      if (isOpen() && !nav.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("a")) setOpen(false);
    });
    // Tabbing out of the open panel closes it, so focus is never left under it.
    function closeOnFocusLeave(e) {
      const to = e.relatedTarget;
      if (isOpen() && to && !nav.contains(to) && to !== toggle) setOpen(false);
    }
    nav.addEventListener("focusout", closeOnFocusLeave);
    toggle.addEventListener("focusout", closeOnFocusLeave);
    if (window.matchMedia) {
      const wide = window.matchMedia("(min-width: 960px)");
      const onChange = function () { if (wide.matches) setOpen(false); };
      if (wide.addEventListener) wide.addEventListener("change", onChange);
      else if (wide.addListener) wide.addListener(onChange);
    }
  }

  function waUrl(text) {
    const digits = WHATSAPP_NUMBER.replace(/\D/g, "");
    return "https://wa.me/" + digits + (text ? "?text=" + encodeURIComponent(text) : "");
  }

  // Call / WhatsApp row in the mobile header, only when a number is set above.
  function initQuickContact() {
    if (!WHATSAPP_NUMBER && !PHONE_NUMBER) return;
    const header = document.querySelector(".site-header");
    if (!header) return;
    const row = document.createElement("div");
    row.className = "wrap quick-contact";
    if (PHONE_NUMBER) {
      const call = document.createElement("a");
      call.className = "btn btn--ghost";
      call.href = "tel:" + PHONE_NUMBER.replace(/[^\d+]/g, "");
      call.textContent = "Call";
      row.appendChild(call);
    }
    if (WHATSAPP_NUMBER) {
      const wa = document.createElement("a");
      wa.className = "btn btn--ghost";
      wa.href = waUrl("");
      wa.target = "_blank";
      wa.rel = "noopener";
      wa.textContent = "WhatsApp";
      row.appendChild(wa);
    }
    header.appendChild(row);
    // Home's closing block: the same Call / WhatsApp links beside "Send a project brief".
    $$("[data-contact-actions]").forEach(function (box) {
      $$("a", row).forEach(function (a) { box.appendChild(a.cloneNode(true)); });
    });
  }

  // ---- Footer year ------------------------------------------------------
  function initYear() {
    const year = document.getElementById("year");
    if (year) year.textContent = String(new Date().getFullYear());
  }

  // ---- Drawings: one stroke draw-in --------------------------------------
  // <svg data-draw="hero"> draws on load (whole sequence <= 1.2 s). Skipped on phones and under
  // reduced motion. Website mode has no other draw-in: nothing moves because the page scrolled.
  const GEOMETRY = "path, line, polyline, polygon, rect, circle, ellipse";
  const pendingDrawings = []; // prepared (hidden) but not yet finished, for beforeprint

  // Strokes are non-scaling, so dash lengths are in screen pixels: path length x screen scale.
  function screenScale(svg) {
    const ctm = svg.getScreenCTM ? svg.getScreenCTM() : null;
    return ctm && Math.abs(ctm.a) > 0 ? Math.abs(ctm.a) : 1;
  }
  function hideStroke(s, scale) {
    const len = Math.ceil(s.raw * scale) + 2;
    s.el.style.transition = "none";
    s.el.style.strokeDasharray = len + " " + len;
    s.el.style.strokeDashoffset = String(len);
  }

  // Annotation points (.note) are not drawn in: they stay put, visible and focusable from the start.
  // The hero's faint model grid (.h-scan) is left out as well: it simply shows.
  const notInNote = function (el) { return !(el.closest && el.closest(".note, .h-scan")); };

  function prepareDrawing(svg) {
    const strokes = [];
    const fades = [];
    const marks = $$(".mark", svg).filter(notInNote);
    const texts = $$("text", svg).filter(notInNote);
    $$(GEOMETRY, svg).forEach(function (el) {
      if (el.classList.contains("mark") || !notInNote(el)) return;
      const cs = window.getComputedStyle(el);
      const dashed = cs.strokeDasharray && cs.strokeDasharray !== "none";
      if (cs.stroke === "none" || dashed || el.classList.contains("pts")) { fades.push(el); return; }
      let len = 0;
      try { len = el.getTotalLength(); } catch (e) { len = 0; }
      if (!(len > 1)) { fades.push(el); return; }
      strokes.push({ el: el, raw: len });
    });
    const scale = screenScale(svg);
    strokes.forEach(function (s) { hideStroke(s, scale); });
    fades.concat(texts).forEach(function (el) { el.style.opacity = "0"; });
    marks.forEach(function (el) {
      el.style.opacity = "0";
      el.style.transformBox = "fill-box";
      el.style.transformOrigin = "50% 100%";
      el.style.transform = "translateY(-6px)";
    });
    const parts = { svg: svg, strokes: strokes, fades: fades, texts: texts, marks: marks, done: false, timer: 0 };
    pendingDrawings.push(parts);
    return parts;
  }

  // Puts a drawing in its complete state at once (end of the animation, or before printing).
  function finishDrawing(parts) {
    if (parts.done) return;
    parts.done = true;
    window.clearTimeout(parts.timer);
    parts.strokes.forEach(function (s) {
      s.el.style.transition = "";
      s.el.style.strokeDasharray = "";
      s.el.style.strokeDashoffset = "";
    });
    parts.fades.concat(parts.texts, parts.marks).forEach(function (el) {
      el.style.transition = "";
      el.style.opacity = "";
      el.style.transform = "";
    });
    const i = pendingDrawings.indexOf(parts);
    if (i !== -1) pendingDrawings.splice(i, 1);
  }

  function playDrawing(parts) {
    if (parts.done) return;
    const spread = 400;
    const dur = 620;
    const n = parts.strokes.length;
    // Re-measure now: a font swap, rotation or resize since load changes the screen scale.
    const scale = screenScale(parts.svg);
    parts.strokes.forEach(function (s) { hideStroke(s, scale); });
    parts.svg.getBoundingClientRect(); // commit the hidden state before transitioning
    window.requestAnimationFrame(function () {
      if (parts.done) return;
      parts.strokes.forEach(function (s, i) {
        const delay = n > 1 ? Math.round((i / (n - 1)) * spread) : 0;
        s.el.style.transition = "stroke-dashoffset " + dur + "ms " + EASE + " " + delay + "ms";
        s.el.style.strokeDashoffset = "0";
      });
      const fadeCount = parts.fades.length;
      parts.fades.forEach(function (el, i) {
        const seq = el.getAttribute("data-seq");
        const pos = seq !== null ? Number(seq) / 8 : (fadeCount > 1 ? i / (fadeCount - 1) : 0);
        el.style.transition = "opacity 360ms " + EASE + " " + Math.round(120 + pos * spread) + "ms";
        el.style.opacity = "";
      });
      const textDelay = Math.round(spread + dur * 0.35);
      parts.texts.forEach(function (el) {
        el.style.transition = "opacity 260ms " + EASE + " " + textDelay + "ms";
        el.style.opacity = "";
      });
      const markDelay = spread + dur - 40;
      parts.marks.forEach(function (el) {
        el.style.transition = "opacity 180ms " + EASE + " " + markDelay + "ms, transform 180ms " + EASE + " " + markDelay + "ms";
        el.style.opacity = "";
        el.style.transform = "";
      });
      parts.timer = window.setTimeout(function () { finishDrawing(parts); }, spread + dur + 400);
    });
  }

  function initDrawings() {
    const svgs = $$('svg[data-draw="hero"]');
    if (!svgs.length || reduceMotion) return;
    // v3 inner kit: phones drop the decorative draw-in (the drawing simply shows, complete).
    const phone = !!(window.matchMedia && window.matchMedia("(max-width: 767.98px)").matches);
    svgs.forEach(function (svg) {
      if (phone && svg.closest && svg.closest(".v-hero, .v-row, .v-tile, .v-bench")) return;
      // On a slow load the CSS fallback shows the hero complete at 1.2 s. If this script arrives
      // that late (or close to it), leave the drawing as it is rather than blank it and redraw.
      if (window.performance && typeof performance.now === "function" && performance.now() > 1000) return;
      let parts;
      try { parts = prepareDrawing(svg); } catch (e) { return; }
      playDrawing(parts);
    });
  }

  // Printing: show a drawing that is still drawing in complete.
  window.addEventListener("beforeprint", function () {
    pendingDrawings.slice().forEach(finishDrawing);
  });

  // ---- Copy buttons ---------------------------------------------------------
  function copyText(text) {
    function fallback() {
      return new Promise(function (resolve, reject) {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-1000px";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        if (ok) resolve(); else reject(new Error("copy failed"));
      });
    }
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(fallback);
    }
    return fallback();
  }

  function statusFor(btn) {
    const id = btn.getAttribute("data-status");
    let el = id ? document.getElementById(id) : null;
    if (!el) {
      const scope = btn.closest(".method") || btn.parentNode;
      el = scope ? scope.querySelector('[role="status"]') : null;
    }
    if (!el) {
      el = document.createElement("span");
      el.className = "copy-status";
      el.setAttribute("role", "status");
      btn.insertAdjacentElement("afterend", el);
    }
    return el;
  }

  function announce(el, message) {
    window.clearTimeout(el._clear);
    el.textContent = "";
    window.setTimeout(function () { el.textContent = message; }, 40);
    el._clear = window.setTimeout(function () { el.textContent = ""; }, 5000);
  }

  function initCopy() {
    $$(".copy-btn[data-copy]").forEach(function (btn) {
      if (btn.tagName === "BUTTON" && !btn.getAttribute("type")) btn.setAttribute("type", "button");
      btn.addEventListener("click", function () {
        const status = statusFor(btn);
        copyText(btn.getAttribute("data-copy")).then(
          function () { announce(status, "Copied"); },
          function () { announce(status, "Could not copy. Select the address and copy it."); }
        );
      });
    });
  }

  // ---- Enquiry form ----------------------------------------------------------
  function labelText(form, field) {
    const label = field.id ? form.querySelector('label[for="' + field.id + '"]') : null;
    if (!label) return field.name;
    const clone = label.cloneNode(true);
    $$(".opt, .hint", clone).forEach(function (n) { n.parentNode.removeChild(n); });
    return clone.textContent.replace(/\s+/g, " ").trim();
  }

  function initForm() {
    const form = document.getElementById("enquiry");
    if (!form) return;
    form.setAttribute("novalidate", "");

    // ?type=<slug> pre-selects a project type only when it matches an existing option value.
    const typeSelect = form.elements.namedItem("type");
    if (typeSelect && typeSelect.options) {
      let wanted = null;
      try { wanted = new URLSearchParams(window.location.search).get("type"); } catch (e) { wanted = null; }
      if (wanted) {
        for (let i = 0; i < typeSelect.options.length; i++) {
          if (typeSelect.options[i].value === wanted) { typeSelect.selectedIndex = i; break; }
        }
      }
    }

    // The WhatsApp button exists in the markup (hidden) and is shown only when a number is set.
    const waButton = form.querySelector('button[value="whatsapp"]');
    if (waButton) {
      if (WHATSAPP_NUMBER) {
        waButton.hidden = false;
        const helper = document.getElementById("form-helper");
        if (helper) helper.textContent = "Both options open your own app with your details filled in. Nothing is sent until you press send there.";
      }
      else waButton.parentNode.removeChild(waButton);
    }

    const fields = $$("input, select, textarea", form).filter(function (f) {
      return f.name && f.type !== "hidden" && f.type !== "submit" && f.type !== "button";
    });

    let summary = form.querySelector(".error-summary");
    if (!summary) {
      summary = document.createElement("div");
      summary.className = "error-summary";
      summary.hidden = true;
      form.insertBefore(summary, form.firstChild);
    }
    summary.setAttribute("tabindex", "-1");
    if (!summary.getAttribute("role")) summary.setAttribute("role", "group");
    let summaryList = summary.querySelector("ul");
    if (!summary.querySelector("h2")) {
      const h = document.createElement("h2");
      h.textContent = "There is a problem";
      summary.insertBefore(h, summary.firstChild);
    }
    if (!summaryList) {
      summaryList = document.createElement("ul");
      summary.appendChild(summaryList);
    }
    const heading = summary.querySelector("h2");
    if (!heading.id) heading.id = "enquiry-errors-title";
    summary.setAttribute("aria-labelledby", heading.id);

    let status = document.getElementById("form-status");
    if (!status) {
      status = document.createElement("p");
      status.id = "form-status";
      status.className = "form-note";
      status.setAttribute("role", "status");
      const foot = form.querySelector(".form-foot") || form;
      foot.appendChild(status);
    }

    function errorFor(field) {
      const v = (field.value || "").trim();
      if (field.required && !v) {
        return field.getAttribute("data-error") || ("Enter " + labelText(form, field).toLowerCase() + ".");
      }
      if (v && field.type === "tel") {
        const digits = v.replace(/\D/g, "");
        if (!/^[+()\-.\s\d]+$/.test(v) || digits.length < 7 || digits.length > 15) {
          return "Enter a phone number using digits, spaces and + only, or leave it blank.";
        }
      }
      if (v && field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        return "Enter an email address like name@example.com.";
      }
      return "";
    }

    function errorEl(field) {
      const id = (field.id || field.name) + "-error";
      let el = document.getElementById(id);
      if (!el) {
        el = document.createElement("p");
        el.id = id;
        el.className = "field-error";
        (field.closest(".field") || field.parentNode).appendChild(el);
      }
      return el;
    }

    function setDescribedBy(field, id, on) {
      const tokens = (field.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
      const has = tokens.indexOf(id) !== -1;
      if (on && !has) tokens.unshift(id);
      if (!on && has) tokens.splice(tokens.indexOf(id), 1);
      if (tokens.length) field.setAttribute("aria-describedby", tokens.join(" "));
      else field.removeAttribute("aria-describedby");
    }

    function showFieldError(field, message) {
      const el = errorEl(field);
      el.textContent = message;
      if (message) {
        field.setAttribute("aria-invalid", "true");
        setDescribedBy(field, el.id, true);
      } else {
        field.removeAttribute("aria-invalid");
        setDescribedBy(field, el.id, false);
      }
    }

    function renderSummary(errors) {
      while (summaryList.firstChild) summaryList.removeChild(summaryList.firstChild);
      errors.forEach(function (err) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = "#" + err.field.id;
        a.textContent = err.message;
        a.addEventListener("click", function (e) {
          e.preventDefault();
          err.field.focus();
        });
        li.appendChild(a);
        summaryList.appendChild(li);
      });
      summary.hidden = errors.length === 0;
    }

    function validate() {
      const errors = [];
      fields.forEach(function (field) {
        const message = errorFor(field);
        showFieldError(field, message);
        if (message) errors.push({ field: field, message: message });
      });
      return errors;
    }

    // Once a field has shown an error, re-check it as the visitor fixes it.
    fields.forEach(function (field) {
      const recheck = function () {
        if (field.getAttribute("aria-invalid") !== "true") return;
        const message = errorFor(field);
        showFieldError(field, message);
        if (!summary.hidden) {
          const remaining = fields
            .filter(function (f) { return f.getAttribute("aria-invalid") === "true"; })
            .map(function (f) { return { field: f, message: errorEl(f).textContent }; });
          renderSummary(remaining);
        }
      };
      field.addEventListener("input", recheck);
      field.addEventListener("change", recheck);
    });

    function collect() {
      const lines = [];
      let name = "";
      let typeText = "";
      let message = "";
      fields.forEach(function (field) {
        let value = (field.value || "").trim();
        if (!value) return;
        if (field.tagName === "SELECT") value = field.options[field.selectedIndex].text.trim();
        if (field.name === "name") name = value;
        if (field.name === "type") typeText = value;
        if (field.tagName === "TEXTAREA") { message = value; return; }
        lines.push(labelText(form, field) + ": " + value);
      });
      if (message) lines.push("", message);
      const subject = "Project brief" + (typeText ? ": " + typeText : "") + (name ? " (" + name + ")" : "");
      return { subject: subject, body: lines.join("\n") };
    }

    let lastSubmitter = null;
    form.addEventListener("click", function (e) {
      const b = e.target.closest ? e.target.closest("button") : null;
      if (b && (b.type === "submit")) lastSubmitter = b;
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const submitter = e.submitter || lastSubmitter;
      lastSubmitter = null;
      const via = submitter && submitter.value === "whatsapp" && WHATSAPP_NUMBER ? "whatsapp" : "email";

      const errors = validate();
      if (errors.length) {
        renderSummary(errors);
        status.textContent = "";
        summary.focus();
        return;
      }
      renderSummary([]);

      const data = collect();
      if (via === "whatsapp") {
        const a = document.createElement("a");
        a.href = waUrl(data.subject + "\n\n" + data.body);
        a.target = "_blank";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        status.textContent = "WhatsApp should now be open with the brief filled in. Nothing is sent until you press send there. " +
          "If it did not open, copy the address " + EMAIL + " and write to us directly.";
        return;
      }

      // Some mail handlers truncate or refuse long mailto: links, so cap the encoded link at 1,900 characters.
      const MAX_HREF = 1900;
      const base = "mailto:" + EMAIL + "?subject=" + encodeURIComponent(data.subject) + "&body=";
      const encode = function (text) { return encodeURIComponent(text.replace(/\n/g, "\r\n")); };
      const cut = function (n) {
        let t = data.body.slice(0, n);
        if (/[\uD800-\uDBFF]$/.test(t)) t = t.slice(0, -1); // never split a surrogate pair
        return t;
      };
      let body = data.body;
      let shortened = false;
      if ((base + encode(body)).length > MAX_HREF) {
        shortened = true;
        const note = "\n…\n(Shortened: paste the rest of your description here.)";
        let lo = 0;
        let hi = data.body.length;
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2);
          if ((base + encode(cut(mid) + note)).length <= MAX_HREF) lo = mid; else hi = mid - 1;
        }
        body = cut(lo) + note;
      }
      const href = base + encode(body);
      window.location.href = href;
      status.textContent = "Your email app should now be open with the brief filled in. Nothing is sent until you press send there. " +
        (shortened ? "Your description was long, so paste the rest into the email. " : "") +
        "If it did not open, copy the address " + EMAIL + " and write to us directly.";
    });
  }

  // ---- Drawing annotations: one shared note --------------------------------------
  // <g class="note" aria-label="…" data-note="…"> inside a drawing; tabindex and role="button" are
  // added here, so without JS the notes are not dead tab stops (their text is in the figcaption).
  // Hover, focus, tap, Enter or Space shows the note; Escape or a tap elsewhere hides it.
  const SVG_NS = "http://www.w3.org/2000/svg";
  const HIT_PX = 22; // on-screen radius of the hit circle: a 44px target

  function initNotes() {
    const notes = $$(".note");
    if (!notes.length) return;
    const tip = document.createElement("div");
    tip.className = "drawing-note";
    tip.setAttribute("aria-hidden", "true");
    document.body.appendChild(tip);
    const header = document.querySelector(".site-header");
    let current = null;
    let hideTimer = 0;
    let clearTimer = 0;

    const svgs = [];
    notes.forEach(function (note) {
      const svg = note.ownerSVGElement;
      if (svg && svgs.indexOf(svg) === -1) svgs.push(svg);
      // Children of role="img" are hidden from assistive tech; the notes are buttons.
      if (svg && svg.getAttribute("role") === "img") svg.setAttribute("role", "group");
      if (!note.hasAttribute("tabindex")) note.setAttribute("tabindex", "0");
      if (!note.getAttribute("role")) note.setAttribute("role", "button");
      if (!note.getAttribute("aria-label") && note.getAttribute("data-note")) {
        note.setAttribute("aria-label", note.getAttribute("data-note"));
      }
      let hit = note.querySelector(".note-hit") || note.querySelector('circle[r="12"]');
      if (!hit) {
        let box = null;
        try { box = note.getBBox(); } catch (e) { box = null; }
        if (!box) return;
        hit = document.createElementNS(SVG_NS, "circle");
        hit.setAttribute("cx", String(box.x + box.width / 2));
        hit.setAttribute("cy", String(box.y + box.height / 2));
        hit.setAttribute("r", "12");
        note.insertBefore(hit, note.firstChild);
      }
      hit.classList.add("note-hit");
      hit.setAttribute("aria-hidden", "true");
    });

    // r=12 in drawing units; on a narrow plate that is under 12px, so grow it to keep 24px.
    function sizeHits() {
      svgs.forEach(function (svg) {
        const scale = screenScale(svg);
        const r = Math.max(12, HIT_PX / scale);
        $$(".note-hit", svg).forEach(function (c) { c.setAttribute("r", r.toFixed(2)); });
      });
      // A drawing cropped to its frame (Home's hero uses "slice") can push a note out of view:
      // such a note leaves the tab order until a resize brings it back.
      notes.forEach(function (note) {
        const svg = note.ownerSVGElement;
        const hit = note.querySelector(".note-hit");
        if (!svg || !hit) return;
        const s = svg.getBoundingClientRect();
        const h = hit.getBoundingClientRect();
        const x = h.left + h.width / 2;
        const y = h.top + h.height / 2;
        const inside = x >= s.left && x <= s.right && y >= s.top && y <= s.bottom;
        note.tabIndex = inside ? 0 : -1;
        if (inside) note.removeAttribute("aria-hidden"); else note.setAttribute("aria-hidden", "true");
      });
    }
    sizeHits();

    function place(note) {
      const hit = note.querySelector(".note-hit") || note;
      const nr = hit.getBoundingClientRect();
      const plate = note.closest(".plate") || note.ownerSVGElement || note;
      const pr = plate.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const M = 8;
      const GAP = 8;
      const left = Math.max(pr.left, 0) + M;
      const right = Math.min(pr.right, vw) - M;
      tip.style.maxWidth = Math.max(160, Math.min(320, right - left)) + "px";
      const tw = tip.offsetWidth;
      const th = tip.offsetHeight;
      let x = nr.left + nr.width / 2 - tw / 2;
      x = Math.min(Math.max(x, left), Math.max(left, right - tw));
      x = Math.min(Math.max(x, M), Math.max(M, vw - M - tw)); // never off the viewport
      const headerBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
      const bar = document.querySelector(".mobile-cta.is-shown");
      const floor = (bar ? bar.getBoundingClientRect().top : vh) - M;
      const ceiling = Math.max(headerBottom, Math.max(pr.top, 0)) + M;
      let y = nr.top - GAP - th;
      let side = "above";
      if (y < ceiling && nr.bottom + GAP + th <= floor) { y = nr.bottom + GAP; side = "below"; }
      y = Math.min(Math.max(y, headerBottom + M), Math.max(headerBottom + M, floor - th));
      tip.setAttribute("data-side", side);
      tip.style.left = Math.round(x + window.pageXOffset) + "px";
      tip.style.top = Math.round(y + window.pageYOffset) + "px";
    }

    function show(note) {
      window.clearTimeout(hideTimer);
      window.clearTimeout(clearTimer);
      const text = note.getAttribute("data-note") || note.getAttribute("aria-label") || "";
      if (!text) return;
      if (current && current !== note) current.classList.remove("is-active");
      current = note;
      note.classList.add("is-active");
      if (tip.textContent !== text) tip.textContent = text;
      place(note);
      tip.classList.add("is-open");
    }
    function hide() {
      window.clearTimeout(hideTimer);
      if (!current) return;
      current.classList.remove("is-active");
      current = null;
      tip.classList.remove("is-open");
      clearTimer = window.setTimeout(function () { if (!current) tip.textContent = ""; }, 200);
    }
    function hideSoon() {
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(function () {
        if (current && current === document.activeElement) return; // focused: stays until blur/Escape
        hide();
      }, 140);
    }

    notes.forEach(function (note) {
      note.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") show(note); });
      note.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") hideSoon(); });
      note.addEventListener("focus", function () { show(note); });
      note.addEventListener("blur", function () { if (current === note) hide(); });
      note.addEventListener("click", function () { show(note); });
      note.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") { e.preventDefault(); show(note); }
      });
    });
    // The note itself can be hovered (WCAG 1.4.13): moving onto it keeps it open.
    tip.addEventListener("pointerenter", function () { window.clearTimeout(hideTimer); });
    tip.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") hideSoon(); });
    document.addEventListener("keydown", function (e) {
      if ((e.key === "Escape" || e.key === "Esc") && current) hide();
    });
    document.addEventListener("pointerdown", function (e) {
      if (!current) return;
      const t = e.target;
      if (tip.contains(t) || (t.closest && t.closest(".note"))) return;
      hide();
    });
    let resizeFrame = 0;
    window.addEventListener("resize", function () {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(function () {
        sizeHits();
        if (current) place(current);
      });
    });
  }

  // ---- Mobile CTA bar ----------------------------------------------------------
  // Phones only (<768px), not on the contact page. Shows once the hero's primary button has scrolled
  // out of view; hides again when the footer comes into view.
  function initMobileCta() {
    const onContact = /(^|\/)contact(\.html)?$/i.test(window.location.pathname) || !!document.getElementById("enquiry");
    if (onContact || !window.matchMedia || !("IntersectionObserver" in window)) return;
    const mq = window.matchMedia("(max-width: 767.98px)");
    let bar = null;
    let heroGone = false;
    let footerIn = false;

    function update() {
      if (!bar) return;
      const on = mq.matches && heroGone && !footerIn;
      if (!on && bar.contains(document.activeElement)) return; // never yank it from under focus
      bar.classList.toggle("is-shown", on);
      root.classList.toggle("has-mobile-cta", on);
    }

    function build() {
      if (bar) return;
      bar = document.createElement("a");
      bar.className = "mobile-cta btn btn--primary";
      bar.href = "contact.html";
      bar.textContent = "Send a project brief";
      bar.addEventListener("focusout", function () { window.setTimeout(update, 0); });
      document.body.appendChild(bar);

      const anchor = document.querySelector(".hero .btn--primary, .h-hero .btn--primary, .v-hero .btn--primary, .page-hero .btn--primary") ||
        document.querySelector(".hero, .h-hero, .v-hero, .page-hero") ||
        document.querySelector("main > *");
      if (anchor) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            // Out of view above the screen (not still below it).
            heroGone = !entry.isIntersecting && entry.boundingClientRect.top < window.innerHeight / 2;
          });
          update();
        }).observe(anchor);
      } else {
        heroGone = true;
      }
      const footer = document.querySelector(".site-footer");
      if (footer) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) { footerIn = entry.isIntersecting; });
          update();
        }, { rootMargin: "0px 0px 10% 0px" }).observe(footer);
      }

      // Belt and braces for scroll-padding: if focus lands under the bar, scroll it clear.
      document.addEventListener("focusin", function (e) {
        if (!bar.classList.contains("is-shown") || bar.contains(e.target) || !e.target.getBoundingClientRect) return;
        const r = e.target.getBoundingClientRect();
        const barTop = bar.getBoundingClientRect().top;
        if (r.bottom > barTop - 8 && r.top < window.innerHeight) {
          window.scrollBy(0, Math.ceil(r.bottom - barTop + 16));
        }
      });
    }

    function onChange() { if (mq.matches) build(); update(); }
    if (mq.matches) build();
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  initNav();
  initQuickContact();
  initYear();
  initDrawings();
  initNotes();
  initCopy();
  initForm();
  initMobileCta();
})();
