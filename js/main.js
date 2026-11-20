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

  // Calls fn once when el is at least 30% visible (or fills 30% of the viewport).
  function whenVisible(el, fn) {
    if (!("IntersectionObserver" in window)) { fn(); return; }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        const tall = entry.intersectionRect.height >= window.innerHeight * 0.3;
        if (entry.intersectionRatio >= 0.3 || tall) {
          io.disconnect();
          fn();
        }
      });
    }, { threshold: [0, 0.1, 0.2, 0.3, 0.5] });
    io.observe(el);
  }

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
  // <svg data-draw="hero"> draws on load (whole sequence <= 1.2 s).
  // <svg data-draw> draws once when 30% visible. Skipped under reduced motion.
  const GEOMETRY = "path, line, polyline, polygon, rect, circle, ellipse";
  const pendingDrawings = []; // prepared (hidden) but not yet finished

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
  // The hero's scan grid (.h-scan) has its own CSS sweep, so it is left out as well.
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

  function playDrawing(parts, hero) {
    if (parts.done) return;
    const spread = hero ? 400 : 520;
    const dur = hero ? 620 : 760;
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
    const svgs = $$("svg[data-draw]");
    if (!svgs.length || reduceMotion) return;
    svgs.forEach(function (svg) {
      const hero = svg.getAttribute("data-draw") === "hero";
      if (!hero && !("IntersectionObserver" in window)) return; // leave it complete
      // On a slow load the CSS fallback shows the hero complete at 1.2 s. If this script arrives
      // that late (or close to it), leave the drawing as it is rather than blank it and redraw.
      if (hero && window.performance && typeof performance.now === "function" && performance.now() > 1000) return;
      let parts;
      try { parts = prepareDrawing(svg); } catch (e) { return; }
      if (hero) playDrawing(parts, true);
      else whenVisible(svg, function () { playDrawing(parts, false); });
    });
  }

  // Printing: show every drawing and matrix marker complete, whatever has scrolled into view.
  window.addEventListener("beforeprint", function () {
    pendingDrawings.slice().forEach(finishDrawing);
    $$(".matrix[data-fill]").forEach(function (m) { m.classList.add("is-filled"); });
  });

  // ---- Technology matrix: markers fill along the rows ---------------------
  function initMatrix() {
    $$(".matrix[data-fill]").forEach(function (m) {
      if (reduceMotion || !("IntersectionObserver" in window)) { m.classList.add("is-filled"); return; }
      $$(".dot, .ring", m).forEach(function (el, i) {
        el.style.transitionDelay = Math.min(i * 45, 900) + "ms";
      });
      whenVisible(m, function () { m.classList.add("is-filled"); });
    });
  }

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
        status.textContent = "WhatsApp should open with your brief filled in. Nothing is sent until you press send there. " +
          "If it did not open, email your brief to " + EMAIL + ".";
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
      status.textContent = "Your email app should open with your brief filled in. Nothing is sent until you press send there. " +
        (shortened ? "Your description was long, so paste the rest into the email. " : "") +
        "If no email app opened, copy the address " + EMAIL + " and send your brief from any email account.";
    });
  }

  // ---- Reveal: [data-reveal] blocks rise in once ------------------------------
  // Blocks already on screen (or above it) are marked .is-in before html.reveal-ready is set, so
  // they are never hidden. CSS hides the rest only at >=768px without reduced motion.
  function initReveal() {
    const els = $$("[data-reveal]");
    if (!els.length) return;
    const show = function (el) { el.classList.add("is-in"); };
    if (reduceMotion || !("IntersectionObserver" in window)) { els.forEach(show); return; }
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const pending = els.filter(function (el) {
      const r = el.getBoundingClientRect();
      if (r.top < vh) { show(el); return false; } // in view or already scrolled past
      return true;
    });
    root.classList.add("reveal-ready");
    if (!pending.length) return;
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        // Intersecting, or jumped past (an anchor link): show it and stop watching.
        if (entry.isIntersecting || entry.boundingClientRect.bottom < 0) {
          show(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0 });
    pending.forEach(function (el) { io.observe(el); });
  }

  // ---- Drawing annotations: one shared note --------------------------------------
  // <g class="note" tabindex="0" role="button" aria-label="…" data-note="…"> inside a drawing.
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

      const anchor = document.querySelector(".hero .btn--primary, .h-hero .btn--primary, .page-hero .btn--primary") ||
        document.querySelector(".hero, .h-hero, .page-hero") ||
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


  // ---- Home: the survey line ---------------------------------------------------------
  // One decorative path in an SVG that covers <main> from first paint (no layout shift when routed).
  // Default (no JS): a straight guide at the left lane, placed by CSS. Below 960px main.js keeps that
  // guide. From 960px it is routed as one traverse down the right side: from the hero's benchmark,
  // down the bento gutter, along the right margin with a spur to the last station, onto the top paper
  // of the document stack, and down to the closing benchmark. CSS draws it with the scroll; this
  // only measures on resize (no scroll listener).
  function initRail() {
    const svg = document.querySelector(".h-rail");
    if (!svg) return;
    const main = svg.parentNode;
    const path = svg.querySelector(".h-rail__path");
    const grad = svg.querySelector("linearGradient");
    const ticks = svg.querySelector(".h-rail__ticks");
    const NS = "http://www.w3.org/2000/svg";
    const wide = window.matchMedia ? window.matchMedia("(min-width: 960px)") : { matches: false };
    const q = function (s) { return main.querySelector(s); };
    const r = Math.round;
    const kf = document.createElement("style");
    document.head.appendChild(kf);
    let frame = 0;

    function build() {
      const mb = main.getBoundingClientRect();
      const W = main.clientWidth;
      const H = main.offsetHeight;
      const box = function (el) {
        const b = el.getBoundingClientRect();
        return { l: b.left - mb.left, r: b.right - mb.left, t: b.top - mb.top, b: b.bottom - mb.top,
          x: (b.left + b.right) / 2 - mb.left, y: (b.top + b.bottom) / 2 - mb.top };
      };
      const at = function (el, x, y) { // a point in an SVG element's own units, in <main> coordinates
        const p = new DOMPoint(x, y).matrixTransform(el.getScreenCTM());
        return { x: p.x - mb.left, y: p.y - mb.top };
      };
      // Colour by band: teal on light grounds, light teal on ink, cream on rust.
      while (grad.firstChild) grad.removeChild(grad.firstChild);
      const stop = function (y, kind) {
        const s = document.createElementNS(NS, "stop");
        s.setAttribute("offset", String(Math.min(1, Math.max(0, y / H))));
        s.setAttribute("class", "h-rail__stop" + (kind ? " h-rail__stop--" + kind : ""));
        grad.appendChild(s);
      };
      stop(0, "");
      [[".h-how", "night"], [".h-docs", "rust"]].forEach(function (bd) {
        const el = q(bd[0]);
        if (!el) return;
        const b = box(el);
        stop(b.t, ""); stop(b.t, bd[1]); stop(b.b, bd[1]); stop(b.b, "");
      });
      grad.setAttribute("y2", String(H));
      while (ticks.firstChild) ticks.removeChild(ticks.firstChild);

      const top = mb.top + window.pageYOffset;
      const vh = window.innerHeight;
      const HEAD = 0.72; // the drawn head sits about here on the screen
      const hero = q(".h-hero .mark");
      const tiles = $$(".h-tile", main);
      const paper = q('.h-sheets .sheet[data-index="0"] .sheet-paper');
      const sheets = q(".h-sheets");
      const end = q("[data-rail-end]");
      const head = q("#build-h");
      let route;
      let rings = [];
      if (wide.matches && hero && head && tiles.length > 1 && paper && sheets && end) {
        // Build the route as H/V runs and remember the length at every corner, so the draw can be
        // keyed to where each corner sits on the page (horizontal runs then draw in a short step).
        const d = [];
        const corners = [];
        let cx = 0, cy = 0, len = 0;
        const M = function (x, y) { cx = r(x); cy = r(y); d.push("M" + cx + " " + cy); corners.push([cy, len, 0]); };
        const V = function (y) { y = r(y); len += Math.abs(y - cy); cy = y; d.push("V" + y); corners.push([cy, len, 0]); };
        const Hz = function (x) { x = r(x); len += Math.abs(x - cx); cx = x; d.push("H" + x); corners.push([cy, len, 1]); };
        const ring = function (kind) { rings.push([cx, cy, kind, corners.length - 1]); };
        const s = box(hero);
        const ink = document.createRange(); // the heading's text, not its block
        ink.selectNodeContents(head);
        const h2 = { r: ink.getBoundingClientRect().right - mb.left };
        const bento = box(q(".h-bento"));
        const a = box(tiles[0]);
        const b = box(tiles[1]);
        const right = Math.min(W - 12, bento.r + 28);
        M(s.x, s.b);
        if (h2.r + 20 > s.x) { V(Math.max(s.b + 8, box(q(".h-hero")).b - 16)); Hz(h2.r + 28); } // pass the heading, never box it
        // Down the gutter between the tall tile and the wide one, then out along the gap under the wide
        // tile (inside the grid, never as a rule under it), to the right-hand lane.
        const c = tiles[2] ? box(tiles[2]) : null;
        const gapY = c && c.t > b.b ? (b.b + c.t) / 2 : bento.b + 14;
        V(bento.t - 20); Hz((a.r + b.l) / 2); ring("ground"); V(gapY); Hz(right);
        const tabs = q(".h-stations__tabs");
        const dots = $$(".h-st__dot", main);
        if (tabs && !tabs.hidden && dots.length) {
          const st = box(dots[dots.length - 1]);
          V(st.y); ring("night"); Hz(st.r); M(right, st.y);
        }
        const t = at(paper, +paper.getAttribute("x") + paper.getAttribute("width") / 2, +paper.getAttribute("y"));
        V(t.y - 40); Hz(t.x); V(t.y); ring("rust");
        const foot = at(sheets, 240, 400);
        const e = box(end);
        // Before it lands, the benchmark mark sits 8px high (home.css); end the line where it rests.
        if (end.closest("[data-once]:not(.is-on)") && window.getComputedStyle(end).opacity < 1) e.t += 8;
        M(foot.x, foot.y + 12); V(foot.y + 36); Hz(right); V(e.t - 36); Hz(e.x); V(e.t);
        svg.classList.add("is-routed");
        path.setAttribute("d", d.join(""));
        let pos = -Infinity;
        route = corners.map(function (c) {
          pos = Math.max(pos + (c[2] ? 60 : 0), top + c[0] - vh * HEAD);
          return [pos, 1 - c[1] / len];
        });
        rings = rings.map(function (g) { return g.concat(route[g[3]][0]); });
      } else {
        const lane = head ? Math.max(6, box(head).l - 28) : 6;
        svg.classList.add("is-routed");
        path.setAttribute("d", "M" + r(lane) + " 0V" + H);
        route = [[top - vh * HEAD, 1], [top + H - vh * HEAD, 0]];
      }
      svg.classList.add("is-inked");
      // Key the scroll-linked draw to the route: keyframes at each corner's scroll position. Each
      // station ring appears as the line reaches it.
      const from = route[0][0];
      const span = Math.max(1, route[route.length - 1][0] - from);
      let css = "@keyframes h-route{";
      route.forEach(function (k) { css += (((k[0] - from) / span) * 100).toFixed(3) + "%{stroke-dashoffset:" + k[1].toFixed(4) + "}"; });
      css += "}@supports (animation-timeline: scroll()){@media (prefers-reduced-motion: no-preference){";
      rings.forEach(function (g, i) {
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", String(g[0]));
        c.setAttribute("cy", String(g[1]));
        c.setAttribute("r", "4.5");
        c.setAttribute("class", "h-rail__tick h-rail__tick--" + g[2]);
        ticks.appendChild(c);
        css += ".h-rail__tick:nth-child(" + (i + 1) + "){animation:h-tick linear both;animation-timeline:scroll(root block);" +
          "animation-range:" + r(g[4] - 8) + "px " + r(g[4]) + "px}";
      });
      kf.textContent = css + "}}@keyframes h-tick{from{opacity:0}to{opacity:1}}";
      svg.style.setProperty("--rail-a", r(from) + "px");
      svg.style.setProperty("--rail-b", r(from + span) + "px");
      if (window.getComputedStyle(path).animationName !== "none") path.style.animationName = "h-route";
    }
    function schedule() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(build);
    }
    schedule();
    if ("ResizeObserver" in window) new ResizeObserver(schedule).observe(main);
    else window.addEventListener("resize", schedule);
    window.addEventListener("load", schedule);
    window.addEventListener("h:layout", schedule); // the document stack has fanned out
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  }

  // Calls fn(index) as each of an element's sentinel bands crosses the middle of the screen.
  function onBands(host, fn) {
    const bands = host ? $$(".h-sentinels > span", host) : [];
    if (!bands.length || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) fn(bands.indexOf(e.target)); });
    }, { rootMargin: "-50% 0px -49% 0px" });
    bands.forEach(function (b) { io.observe(b); });
  }

  // ---- Home: stations (tabs from 900px; below that a stepper with every stage visible) --------
  // Stages change only when the reader asks: a tab, the arrow keys, or "Next" in the panel.
  function initStations() {
    const box = document.querySelector("[data-stations]");
    if (!box) return;
    const list = box.querySelector(".h-stations__tabs");
    const tabs = $$("[data-tab]", box);
    const panels = tabs.map(function (t) { return document.getElementById(t.getAttribute("aria-controls")); });
    if (!list || panels.indexOf(null) !== -1) return;
    const mq = window.matchMedia ? window.matchMedia("(min-width: 900px)") : { matches: false };
    let current = 0;

    function select(i, focus) {
      current = i;
      tabs.forEach(function (t, j) {
        const on = j === i;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        panels[j].hidden = !on;
      });
      if (focus) tabs[i].focus();
    }
    function mode() {
      const on = !!mq.matches;
      list.hidden = !on;
      box.classList.toggle("is-tabs", on);
      if (on) {
        list.setAttribute("role", "tablist");
        list.setAttribute("aria-label", "How a project runs");
      } else {
        list.removeAttribute("role");
        list.removeAttribute("aria-label");
      }
      tabs.forEach(function (t, j) {
        const p = panels[j];
        if (on) {
          t.setAttribute("role", "tab");
          p.setAttribute("role", "tabpanel");
          p.setAttribute("aria-labelledby", t.id);
          p.tabIndex = 0;
        } else {
          t.removeAttribute("role");
          t.removeAttribute("aria-selected");
          p.removeAttribute("role");
          p.removeAttribute("aria-labelledby");
          p.removeAttribute("tabindex");
          p.hidden = false;
        }
      });
      $$("[data-next]", box).forEach(function (n) { n.hidden = !on; });
      if (on) select(current);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(i); });
      t.addEventListener("keydown", function (e) {
        const n = tabs.length;
        let to = -1;
        if (e.key === "ArrowRight" || e.key === "Right") to = (i + 1) % n;
        else if (e.key === "ArrowLeft" || e.key === "Left") to = (i - 1 + n) % n;
        else if (e.key === "Home") to = 0;
        else if (e.key === "End") to = n - 1;
        if (to < 0) return;
        e.preventDefault();
        select(to, true);
      });
    });
    panels.forEach(function (p, i) {
      const next = p.querySelector("[data-next]");
      if (next && tabs[i + 1]) next.addEventListener("click", function () { select(i + 1, true); });
    });
    mode();
    if (mq.addEventListener) mq.addEventListener("change", mode);
    else if (mq.addListener) mq.addListener(mode);
  }

  // ---- Home: the screen's three states where scroll timelines are missing -------------------
  function initScreen() {
    const screen = document.querySelector("[data-screen]");
    if (!screen || reduceMotion) return;
    if (window.CSS && CSS.supports && CSS.supports("animation-timeline: view()")) return; // CSS does it
    if (!("IntersectionObserver" in window)) return; // the three stay stacked, all visible
    screen.classList.add("is-io");
    screen.setAttribute("data-state", "1");
    onBands(screen, function (i) { screen.setAttribute("data-state", String(i + 1)); });
  }

  // ---- Home: once-on-view states (the document fan, the benchmark mark) ----------------------
  function initOnce() {
    $$("[data-fan], [data-once]").forEach(function (el) {
      const done = function () {
        el.classList.add("is-on");
        // The survey line ends on the top paper and the benchmark: re-measure once they settle.
        window.setTimeout(function () { window.dispatchEvent(new Event("h:layout")); }, reduceMotion ? 0 : 560);
      };
      if (reduceMotion) { done(); return; }
      whenVisible(el, done);
    });
  }

  window.addEventListener("beforeprint", function () {
    $$("[data-reveal]").forEach(function (el) { el.classList.add("is-in"); });
    $$("[data-fan], [data-once]").forEach(function (el) { el.classList.add("is-on"); });
  });

  initNav();
  initQuickContact();
  initYear();
  initReveal();
  initDrawings();
  initNotes();
  initMatrix();
  initCopy();
  initForm();
  initMobileCta();
  initStations();
  initRail();
  initScreen();
  initOnce();
})();
