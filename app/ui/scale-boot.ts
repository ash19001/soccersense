/**
 * The pixel scale, before the page's own code has loaded.
 *
 * The pages are built ahead of time, for a screen nobody has seen yet: `PixelRoot` writes
 * the units of a 390 x 844 phone at ratio 1 into the HTML (`DEFAULT_SCALE` in scale.ts), and
 * the real ones only arrive when React has taken the page over. Until then every other
 * screen showed the phone's layout, and then everything moved: a third of the way across a
 * monitor, a few pixels on most Android phones (Google's PageSpeed report of 2026-11-19
 * counted it as layout shift, 0.36 on a desktop).
 *
 * So `PixelRoot` puts this script first inside its element in the build-time HTML. The
 * browser runs it as it reads the page, before it lays out anything that follows, and it
 * writes on that element what React will write a moment later:
 *
 *   - the units (`--px`, `--fp`, `--cp`, `--tx`, `--ip-fit`, `--snap`, `--nudge`), as
 *     `pixelVariables(pixelScale(...))` gives them for the window as `readScale` measures it;
 *   - `data-orientation`;
 *   - `data-wide` on a game layout that is wide (`isWide`, and not a contained one), so the
 *     column is where it will be. (The markup inside is still the phone's: ui.css keeps the
 *     menu captions out of sight on a landscape screen until the page is live.)
 *   - `data-boot-wide` on any root whose screen is wide: a note for `WIDE_BOOT` below, which
 *     `PixelRoot` takes off again once the page is live.
 *
 * It is the same arithmetic as scale.ts, written out again in plain old JavaScript because
 * it runs with nothing else loaded. scale-boot.test.ts runs it against `pixelScale`,
 * `pixelVariables` and `isWide` over a grid of windows and ratios: change them together.
 *
 * Nothing here is needed for a page first rendered in the browser (a pop-up, a page reached
 * by a link inside the game): there the real scale is known from the first render.
 */
export const SCALE_BOOT = [
  "(function(){",
  "var e=document.currentScript,M=Math;",
  "if(!e||!(e=e.parentElement))return;",
  // The window, as scale.ts `readScale` measures it.
  "var w=innerWidth,h=innerHeight,r=devicePixelRatio,v=window.visualViewport;",
  "r=isFinite(r)&&r>0?M.min(16,M.max(.2,r)):1;",
  "var z=v&&v.scale!=null?v.scale:1;",
  "var W=v&&M.abs(v.width*z-w)<1?v.width*z:w;",
  "var H=v&&M.abs(v.height*z-h)<1?v.height*z:h;",
  // `pixelScale`.
  "var a=M.max(1,M.floor(W)),b=M.max(1,M.floor(H)),p=b>=a;",
  "var t=M.min(8,M.max(2,p?M.min(M.round(a/135),M.floor(b/220)):M.round(b/290)));",
  "var I=r%1===0;",
  "var c=function(d){return M.ceil(d/r*1e5-1e-6)/1e5};",
  "var D=M.max(2,M.round(t*r));",
  "var F=M.max(1,M.round(M.max(1,M.round(t/3))*r));",
  "var T=M.max(1,M.round(M.max(2,t-1)*r));",
  "var C=c(M.max(F,M.ceil(D/2))),S=c(M.max(1,M.round(r))),x=c(D);",
  // `tapSize`, `iconPixel` and `pixelVariables`.
  "var n=I?0:S/64;",
  "var q=M.max(M.ceil((44-n)/(S*2)-1e-9)*S*2,x*14);",
  "var s=e.style;",
  's.setProperty("--px",x+"px");',
  's.setProperty("--fp",c(F)+"px");',
  's.setProperty("--cp",C+"px");',
  's.setProperty("--tx",c(T)+"px");',
  's.setProperty("--ip-fit",c(M.max(1,M.min(D,M.round(q*r/22))))+"px");',
  's.setProperty("--snap",S+"px");',
  's.setProperty("--nudge",n+"px");',
  'e.setAttribute("data-orientation",p?"portrait":"landscape");',
  // `isWide`: noted on the root for the marks inside it, and a game layout that fills the
  // window is marked itself.
  "var L=M.ceil((I?a*r:M.max(1,M.ceil(W*r-1e-3)))/D),k=e.classList;",
  "if(!p&&L>=60+480*C/x){",
  'e.setAttribute("data-boot-wide","");',
  'if(k.contains("ss-game")&&!k.contains("ss-game--contained"))e.setAttribute("data-wide","")',
  "}",
  "})()",
].join("");

/**
 * The same for a part inside a PixelRoot that marks itself `data-wide` on a monitor (the
 * rules card, the legal pages, the sign-in card): first inside that part in the build-time
 * HTML (`useWideMark` in ./wide-mark), it puts the mark on if the script above found the
 * screen wide, so the part is set in its monitor's size from the first paint.
 */
export const WIDE_BOOT =
  '(function(){var e=document.currentScript,r;if(e&&(e=e.parentElement)&&(r=e.closest(".ss-root"))&&r.hasAttribute("data-boot-wide"))e.setAttribute("data-wide","")})()';
