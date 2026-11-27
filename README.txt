PAT Infratech website
=====================
A static site: plain HTML, one stylesheet and one script. No build step, no package.json, no framework.
index.html is the home page. All paths are relative, so the folder works as it is.

Files
  index.html, about.html, services.html,
  technology.html, contact.html        the five pages
  404.html                             shown for any address that does not exist
  css/style.css                        the shared design system (colours and fonts are the tokens at the top)
  css/<page>.css                       optional rules for a single page, if present
  js/main.js                           mobile menu, footer year, drawing animation, copy button, enquiry form
  assets/favicon.svg                   browser tab icon (placeholder; replace with the final logo)
  vercel.json                          security and cache headers for Vercel
  sitemap.xml, robots.txt              for search engines


Publish on Vercel
-----------------
1. Put this folder in a Git repository (GitHub, GitLab or Bitbucket), or install the Vercel CLI.
2. In Vercel choose Add New > Project and import the repository.
3. Settings:
     Framework Preset   Other
     Root Directory     the folder that contains index.html
     Build Command      leave empty (no build)
     Output Directory   .
     Install Command    leave empty
4. Deploy. Vercel serves 404.html automatically for missing addresses and applies the headers in vercel.json.
5. Add the domain patinfratech.com under Project > Settings > Domains and follow the DNS instructions shown there.

With the CLI instead: run  vercel  inside this folder, accept "Other" as the framework and leave the build
command empty; then run  vercel --prod  to publish.

Keep "cleanUrls" off (it is set to false in vercel.json) so the existing .html addresses, canonical links
and sitemap keep working.


Publish on ordinary shared hosting (cPanel, public_html)
---------------------------------------------------------
1. Upload everything in this folder to public_html (or the web root for patinfratech.com).
   vercel.json is ignored there and does no harm.
2. To show 404.html for missing pages on Apache hosting, add this line to a file named .htaccess in public_html:
     ErrorDocument 404 /404.html

The site must sit at the root of its domain (patinfratech.com/, not patinfratech.com/site/). 404.html has
an extra first <script> in its <head> that points links at the domain root when a missing address is
nested (for example /old/page); keep that script if you ever re-paste the head of 404.html.


After changing css/style.css, js/main.js or anything in assets/
----------------------------------------------------------------
On Vercel, browsers reuse these files for up to an hour and may keep using a cached copy for up to a
day while they check for a newer one. (Pages themselves are always fresh.)
Every CSS and JS link carries one version key, currently  ?v=4  (css/style.css?v=4, js/main.js?v=4 and
each css/<page>.css?v=4; raised from v=3 for the blue-green colour pass, 2026-11-27). BUMP IT ON EVERY RELEASE: raise the number by one on every CSS and JS link on
all six pages at once, so all pages share the same key. New HTML with an old key can be styled by stale
CSS. Never go back to v=1 (the previous v2 site used it). The favicon keeps its own ?v=1; change it
only if the icon changes.


Settings in js/main.js
----------------------
  WHATSAPP_NUMBER   empty = no WhatsApp buttons. To switch them on, put the number in international form,
                    digits only (country code first, for example 91 followed by the 10-digit mobile number).
                    This shows "Send on WhatsApp" on the contact form and a WhatsApp button in the phone header.
                    The helper line under the form buttons then reads "Both options open your own app..."; the
                    script swaps that wording in. With no number it says the form opens your email app.
  PHONE_NUMBER      empty = no Call button. If set, a Call button appears in the phone header.
  EMAIL             the address the enquiry form writes to. If the address ever changes, replace it
                    everywhere it appears in the six .html files as well.


The enquiry form
----------------
There is no server. "Send by email" opens the visitor's own email app with the brief filled in, addressed to
patinfratechkas@gmail.com. Nothing is sent until the visitor presses send in their app. The email address
stays visible on the page, with a Copy button, for anyone without an email app.
A link like contact.html?type=roads pre-selects the project type. The valid values are:
industrial, datacentres, residential, commercial, development, roads, bridges, tunnels, civil, other.


Logo and drawings
-----------------
The mark in the header of each page is a placeholder <svg class="logo-mark"> inside a fixed 40 x 40 slot.
Replace it with the final logo on all six pages (keep the header identical on every page).
The line drawings are illustrative, not drawings of PAT Infratech projects; the footer says so. A real
project photograph can replace one later: use <img src="assets/your-photo.jpg" alt="what the photo shows"
width="1200" height="800"> in place of the <svg>, change the caption, and check the layout at phone and
desktop widths.

Company details that are not yet on the site (CIN, GSTIN, incorporation date) have marked comment slots
in the HTML. Add them only when they are confirmed. The owner asked to keep personal details off the site
for now.
