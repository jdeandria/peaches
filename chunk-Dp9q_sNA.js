import{B as nt,C as Uc,S as T,h as Mc}from"./chunk-COdvbNJF.js";import{B as s}from"./chunk-BWPwA6Qd.js";import{$ as Ds,$n as ve,At as Oe$1,Ct as M,Dn as jE,Et as Mw,G as BE,Gn as qt,Ht as Uh,In as mg,Jn as se,Jt as Wt,L as $h,Mn as kh,Nn as ld,Nt as Rb,Pt as Re$1,Q as Cr,Qt as Y,Sn as ho,St as LL,T as f$2,Vn as pe,Wn as qh,Wt as Ur,X as Ch,Xn as tR,Y as Ce$1,Yt as X,_n as f,an as Ze$1,at as Es,bn as go,bt as Kh,c as O,cr as xt$1,ct as Fe$1,dn as be,dr as ze$1,dt as Gt,et as Dw,fn as cd,fr as zh,ft as Hh,h as x,hn as dd,ir as ws,jn as ke$1,kn as jo,ln as _w,lt as G,mn as db,mt as Ir,n as Jn,nt as Ed,or as xn,ot as Ew,p as b,qn as sb,qt as Wh,rn as Yt,rr as wr,rt as Ei,sr as xr,tn as Yd,tr as wi,tt as ES,w as d,wn as ie,xn as h1,xt as LE,yn as g,yr as f$1,zt as Sr}from"./main-TWRLWM3V.js";import{t as A}from"./chunk-vMQtSv5H.js";import{t as l}from"./chunk-CltfYI5m.js";import{t as Be$1}from"./chunk-DS1wZatK.js";import{i as kt,n as Gi,r as be$1}from"./chunk-q6QRxwoN.js";import{t as a}from"./chunk-BaLUs-aQ.js";import{c as dt$1,f as me,p as oe,s as de,u as g$1}from"./chunk-nHxGnYq5.js";import{t as M$1}from"./chunk-DmceykYT.js";import{a as Ne$1,i as Mt,l as qt$1,o as Pe$1,r as Be$2,s as Re$2,t as A$1}from"./chunk-Blyl1gsY.js";import{t as u}from"./chunk-Bz4HPbiI.js";import{t as D}from"./chunk-DgWuqmEa.js";import{t as y}from"./chunk-PE8dk_W-.js";import{t as l$1}from"./chunk-O_BecoQU.js";import{t as d$1}from"./chunk-0ceDvrKr.js";import{t as x$1}from"./chunk-6YxqkNhC.js";var Te=(n,i)=>i.peachId;function we(n,i){n&1&&(Wt(0,`pch-card`,0),ws(1,`No standings yet.`),Yt())}function Ie(n,i){n&1&&(Wt(0,`span`,12),ws(1,`(you)`),Yt())}function Me(n,i){if(n&1&&Ds(0,`span`,17),n&2){let t=i.$implicit;dd(t)}}function Re(n,i){if(n&1&&(Wt(0,`span`,14),BE(1,Me,1,2,`span`,16,LE),Yt()),n&2){let t=Es().$implicit,e=Ew(11),a=Es(2);ho(`aria-label`,a.formLabel(t.form)),ke$1(),jE(e)}}function Ee(n,i){n&1&&ws(0,` – `)}function Ne(n,i){if(n&1&&(Wt(0,`tr`)(1,`td`),ws(2),Yt(),Wt(3,`th`,11),ws(4),Gt(5,Ie,2,0,`span`,12),Yt(),Wt(6,`td`),ws(7),Yt(),Wt(8,`td`),ws(9),Yt(),Wt(10,`td`,13),qh(11),Gt(12,Re,3,1,`span`,14)(13,Ee,1,0),Yt(),Wt(14,`td`,15),ws(15),Yt(),Wt(16,`td`,15),ws(17),Yt()()),n&2){let t=i.$implicit,e=i.$index,a=Es(2),l=t.peachId===a.highlightPeachId();Ce$1(`highlight`,l),ho(`aria-current`,l?`true`:null),ke$1(2),Hh(e+1),ke$1(2),go(` `,t.name,` `),ke$1(),qt(l?5:-1),ke$1(2),$h(``,t.wins,`-`,t.losses,`-`,t.ties),ke$1(),Ce$1(`hot`,t.onWinningStreak),ke$1(),Hh(t.streak||`–`),ke$1(2);let c=Dw(a.recent(t.form));ke$1(),qt(c.length?12:13),ke$1(3),Hh(a.points(t.pointsFor)),ke$1(2),Hh(a.points(t.pointsAgainst))}}function De(n,i){if(n&1&&(Wt(0,`pch-card`,1)(1,`div`,2)(2,`table`)(3,`thead`,3)(4,`tr`)(5,`th`,4),ws(6,`#`),Yt(),Wt(7,`th`,4),ws(8,`Peach`),Yt(),Wt(9,`th`,4),ws(10,`W-L-T`),Yt(),Wt(11,`th`,4),ws(12,`Streak`),Yt(),Wt(13,`th`,5),ws(14,`Form`),Yt(),Wt(15,`th`,6)(16,`abbr`,7),ws(17,`PF`),Yt()(),Wt(18,`th`,6)(19,`abbr`,8),ws(20,`PA`),Yt()()()(),Wt(21,`tbody`,9),BE(22,Ne,18,16,`tr`,10,Te),Yt()()()()),n&2){let t=Es();ke$1(),ho(`aria-label`,t.label()),ke$1(21),jE(t.rows())}}function Pe(n){return Number.isInteger(n)?String(n):n.toFixed(1)}var Ae={win:`Win`,loss:`Loss`,tie:`Tie`};var dt=class n{rows=mg.required();highlightPeachId=mg();label=mg(`Standings`);points=Pe;recent(i){return i.slice(-5)}formLabel(i){let t=this.recent(i);return t.length?`Last ${t.length}: ${t.map(e=>Ae[e]).join(`, `)}`:`No results`}static ɵfac=function(t){return new(t||n)};static ɵcmp=ie({type:n,selectors:[[`pch-standings-table`]],inputs:{rows:[1,`rows`],highlightPeachId:[1,`highlightPeachId`],label:[1,`label`]},decls:2,vars:1,consts:[[`variant`,`outlined`],[1,`card`],[`role`,`region`,`tabindex`,`0`,1,`scroll`],[1,`pch-label-large`],[`scope`,`col`],[`scope`,`col`,1,`form`],[`scope`,`col`,1,`num`],[`title`,`Points for`],[`title`,`Points against`],[1,`pch-body-medium`],[3,`highlight`],[`scope`,`row`,1,`name`],[1,`pch-visually-hidden`],[1,`form`],[`role`,`img`,1,`dots`],[1,`num`],[1,`dot`,3,`class`],[1,`dot`]],template:function(t,e){t&1&&Gt(0,we,2,0,`pch-card`,0)(1,De,24,1,`pch-card`,1),t&2&&qt(e.rows().length===0?0:1)},dependencies:[l$1],styles:[`[_nghost-%COMP%]{display:block;container-type:inline-size}.card[_ngcontent-%COMP%]{--%NS%pch-card-padding: 0}.scroll[_ngcontent-%COMP%]{overflow-x:auto;border-radius:inherit}.scroll[_ngcontent-%COMP%]:focus-visible{outline-offset:-3px}table[_ngcontent-%COMP%]{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;white-space:nowrap}th[_ngcontent-%COMP%], td[_ngcontent-%COMP%]{padding:0 10px;text-align:start;border-bottom:.5px solid var(--%NS%mat-sys-outline-variant)}th[_ngcontent-%COMP%]:first-child, td[_ngcontent-%COMP%]:first-child{padding-inline-start:16px}th[_ngcontent-%COMP%]:last-child, td[_ngcontent-%COMP%]:last-child{padding-inline-end:16px}thead[_ngcontent-%COMP%]   th[_ngcontent-%COMP%]{height:44px;color:var(--%NS%mat-sys-on-surface-variant)}abbr[_ngcontent-%COMP%]{text-decoration:none}tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]{height:48px}tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]:last-child > *[_ngcontent-%COMP%]{border-bottom:0}.name[_ngcontent-%COMP%]{font-weight:500}.num[_ngcontent-%COMP%]{text-align:end}.highlight[_ngcontent-%COMP%]{background:var(--%NS%mat-sys-secondary-container);color:var(--%NS%mat-sys-on-secondary-container)}.hot[_ngcontent-%COMP%]{color:var(--%NS%mat-sys-primary);font-weight:600}.form[_ngcontent-%COMP%]{display:none}.dots[_ngcontent-%COMP%]{display:inline-flex;gap:4px;vertical-align:middle}.dot[_ngcontent-%COMP%]{width:10px;height:10px;border-radius:50%}.dot.win[_ngcontent-%COMP%]{background:var(--%NS%mat-sys-primary)}.dot.loss[_ngcontent-%COMP%]{background:color-mix(in srgb,var(--%NS%mat-sys-error) 60%,transparent)}.dot.tie[_ngcontent-%COMP%]{background:var(--%NS%mat-sys-outline)}@container (min-width: 600px){.form[_ngcontent-%COMP%]{display:table-cell}}`]})};var Ve=[`*`];var mt=class n{color=mg();resolved=ve(()=>a(this.color())??`var(--mat-sys-on-surface-variant)`);static ɵfac=function(t){return new(t||n)};static ɵcmp=ie({type:n,selectors:[[`pch-status-label`]],hostAttrs:[1,`pch-label-medium`],hostVars:2,hostBindings:function(t,e){t&2&&ld(`color`,e.resolved())},inputs:{color:[1,`color`]},ngContentSelectors:Ve,decls:2,vars:0,consts:[[`aria-hidden`,`true`,1,`dot`]],template:function(t,e){t&1&&(xn(),Ze$1(0,`span`,0),be(1))},styles:[`[_nghost-%COMP%]{display:inline-flex;align-items:center;gap:6px}.dot[_ngcontent-%COMP%]{flex:none;width:8px;height:8px;border-radius:50%;background:currentColor}`]})};var m=(function(n){return n[n.START=1]=`START`,n[n.END=2]=`END`,n})(m||{});var H=(function(n){return n[n.ACTIVE=0]=`ACTIVE`,n[n.INACTIVE=1]=`INACTIVE`,n})(H||{});var yt=new g(`_MatSlider`);var ye=new g(`_MatSliderThumb`);var Oe=new g(`_MatSliderRangeThumb`);var xe=new g(`_MatSliderVisualThumb`);var Le=(()=>{class n{_cdr=f(xr);_ngZone=f(M);_slider=f(yt);_renderer=f(ze$1);_listenerCleanups;discrete=!1;thumbPosition;valueIndicatorText;_ripple;_knob;_valueIndicatorContainer;_sliderInput;_sliderInputEl;_hoverRippleRef;_focusRippleRef;_activeRippleRef;_isHovered=!1;_isActive=!1;_isValueIndicatorVisible=!1;_hostElement=f(G).nativeElement;_platform=f(Y);ngAfterViewInit(){let t=this._slider._getInput(this.thumbPosition);t&&(this._ripple.radius=24,this._sliderInput=t,this._sliderInputEl=this._sliderInput._hostElement,this._ngZone.runOutsideAngular(()=>{let e=this._sliderInputEl,a=this._renderer;this._listenerCleanups=[a.listen(e,`pointermove`,this._onPointerMove),a.listen(e,`pointerdown`,this._onDragStart),a.listen(e,`pointerup`,this._onDragEnd),a.listen(e,`pointerleave`,this._onMouseLeave),a.listen(e,`focus`,this._onFocus),a.listen(e,`blur`,this._onBlur)]}))}ngOnDestroy(){this._listenerCleanups?.forEach(t=>t())}_onPointerMove=t=>{if(this._sliderInput._isFocused)return;let e=this._hostElement.getBoundingClientRect(),a=this._slider._isCursorOnSliderThumb(t,e);this._isHovered=a,a?this._showHoverRipple():this._hideRipple(this._hoverRippleRef)};_onMouseLeave=()=>{this._isHovered=!1,this._hideRipple(this._hoverRippleRef)};_onFocus=()=>{this._hideRipple(this._hoverRippleRef),this._showFocusRipple(),this._hostElement.classList.add(`mdc-slider__thumb--focused`)};_onBlur=()=>{this._isActive||this._hideRipple(this._focusRippleRef),this._isHovered&&this._showHoverRipple(),this._hostElement.classList.remove(`mdc-slider__thumb--focused`)};_onDragStart=t=>{t.button===0&&(this._isActive=!0,this._showActiveRipple())};_onDragEnd=()=>{this._isActive=!1,this._hideRipple(this._activeRippleRef),this._sliderInput._isFocused||this._hideRipple(this._focusRippleRef),this._platform.SAFARI&&this._showHoverRipple()};_showHoverRipple(){this._isShowingRipple(this._hoverRippleRef)||(this._hoverRippleRef=this._showRipple({enterDuration:0,exitDuration:0}),this._hoverRippleRef?.element.classList.add(`mat-mdc-slider-hover-ripple`))}_showFocusRipple(){this._isShowingRipple(this._focusRippleRef)||(this._focusRippleRef=this._showRipple({enterDuration:0,exitDuration:0},!0),this._focusRippleRef?.element.classList.add(`mat-mdc-slider-focus-ripple`))}_showActiveRipple(){this._isShowingRipple(this._activeRippleRef)||(this._activeRippleRef=this._showRipple({enterDuration:225,exitDuration:400}),this._activeRippleRef?.element.classList.add(`mat-mdc-slider-active-ripple`))}_isShowingRipple(t){return t?.state===Fe$1.FADING_IN||t?.state===Fe$1.VISIBLE}_showRipple(t,e){if(!this._slider.disabled&&(this._showValueIndicator(),this._slider._isRange&&this._slider._getThumb(this.thumbPosition===m.START?m.END:m.START)._showValueIndicator(),!(this._slider._globalRippleOptions?.disabled&&!e)))return this._ripple.launch({animation:this._slider._noopAnimations?{enterDuration:0,exitDuration:0}:t,centered:!0,persistent:!0})}_hideRipple(t){if(t?.fadeOut(),this._isShowingAnyRipple())return;this._slider._isRange||this._hideValueIndicator();let e=this._getSibling();e._isShowingAnyRipple()||(this._hideValueIndicator(),e._hideValueIndicator())}_showValueIndicator(){this._hostElement.classList.add(`mdc-slider__thumb--with-indicator`)}_hideValueIndicator(){this._hostElement.classList.remove(`mdc-slider__thumb--with-indicator`)}_getSibling(){return this._slider._getThumb(this.thumbPosition===m.START?m.END:m.START)}_getValueIndicatorContainer(){return this._valueIndicatorContainer?.nativeElement}_getKnob(){return this._knob.nativeElement}_isShowingAnyRipple(){return this._isShowingRipple(this._hoverRippleRef)||this._isShowingRipple(this._focusRippleRef)||this._isShowingRipple(this._activeRippleRef)}static ɵfac=function(e){return new(e||n)};static ɵcmp=(function(){let t=[`knob`],e=[`valueIndicatorContainer`];function a(l,c){if(l&1&&(Wt(0,`div`,2,1)(2,`div`,5)(3,`span`,6),ws(4),Yt()()()),l&2){let v=Es();ke$1(4),Hh(v.valueIndicatorText)}}return ie({type:n,selectors:[[`mat-slider-visual-thumb`]],viewQuery:function(c,v){if(c&1&&Cr(LL,5)(t,5)(e,5),c&2){let p;Sr(p=Ir())&&(v._ripple=p.first),Sr(p=Ir())&&(v._knob=p.first),Sr(p=Ir())&&(v._valueIndicatorContainer=p.first)}},hostAttrs:[1,`mdc-slider__thumb`,`mat-mdc-slider-visual-thumb`],inputs:{discrete:`discrete`,thumbPosition:`thumbPosition`,valueIndicatorText:`valueIndicatorText`},features:[Kh([{provide:xe,useExisting:n}])],decls:4,vars:2,consts:[[`knob`,``],[`valueIndicatorContainer`,``],[1,`mdc-slider__value-indicator-container`],[1,`mdc-slider__thumb-knob`],[`matRipple`,``,1,`mat-focus-indicator`,3,`matRippleDisabled`],[1,`mdc-slider__value-indicator`],[1,`mdc-slider__value-indicator-text`]],template:function(c,v){c&1&&(Gt(0,a,5,1,`div`,2),Ds(1,`div`,3,0)(3,`div`,4)),c&2&&(qt(v.discrete?0:-1),ke$1(3),Ch(`matRippleDisabled`,!0))},dependencies:[LL],styles:[`.mat-mdc-slider-visual-thumb .mat-ripple {
  height: 100%;
  width: 100%;
}

.mat-mdc-slider .mdc-slider__tick-marks {
  justify-content: start;
}
.mat-mdc-slider .mdc-slider__tick-marks .mdc-slider__tick-mark--active,
.mat-mdc-slider .mdc-slider__tick-marks .mdc-slider__tick-mark--inactive {
  position: absolute;
  left: 2px;
}
`],encapsulation:2})})()}return n})();var Se=(()=>{class n{_ngZone=f(M);_cdr=f(xr);_elementRef=f(G);_dir=f(Ur,{optional:!0});_globalRippleOptions=f(Yd,{optional:!0});_trackActive;_thumbs;_input;_inputs;get disabled(){return this._disabled}set disabled(t){this._disabled=t;let e=this._getInput(m.END),a=this._getInput(m.START);e&&(e.disabled=this._disabled),a&&(a.disabled=this._disabled)}_disabled=!1;get discrete(){return this._discrete}set discrete(t){this._discrete=t,this._updateValueIndicatorUIs()}_discrete=!1;get showTickMarks(){return this._showTickMarks}set showTickMarks(t){this._showTickMarks=t,this._hasViewInitialized&&(this._updateTickMarkUI(),this._updateTickMarkTrackUI())}_showTickMarks=!1;get min(){return this._min}set min(t){let e=t==null||isNaN(t)?this._min:t;this._min!==e&&this._updateMin(e)}_min=0;color;disableRipple=!1;_updateMin(t){let e=this._min;this._min=t,this._isRange?this._updateMinRange({old:e,new:t}):this._updateMinNonRange(t),this._onMinMaxOrStepChange()}_updateMinRange(t){let e=this._getInput(m.END),a=this._getInput(m.START),l=e.value,c=a.value;a.min=t.new,e.min=Math.max(t.new,a.value),a.max=Math.min(e.max,e.value),a._updateWidthInactive(),e._updateWidthInactive(),t.new<t.old?this._onTranslateXChangeBySideEffect(e,a):this._onTranslateXChangeBySideEffect(a,e),l!==e.value&&this._onValueChange(e),c!==a.value&&this._onValueChange(a)}_updateMinNonRange(t){let e=this._getInput(m.END);if(e){let a=e.value;e.min=t,e._updateThumbUIByValue(),this._updateTrackUI(e),a!==e.value&&this._onValueChange(e)}}get max(){return this._max}set max(t){let e=t==null||isNaN(t)?this._max:t;this._max!==e&&this._updateMax(e)}_max=100;_updateMax(t){let e=this._max;this._max=t,this._isRange?this._updateMaxRange({old:e,new:t}):this._updateMaxNonRange(t),this._onMinMaxOrStepChange()}_updateMaxRange(t){let e=this._getInput(m.END),a=this._getInput(m.START),l=e.value,c=a.value;e.max=t.new,a.max=Math.min(t.new,e.value),e.min=a.value,e._updateWidthInactive(),a._updateWidthInactive(),t.new>t.old?this._onTranslateXChangeBySideEffect(a,e):this._onTranslateXChangeBySideEffect(e,a),l!==e.value&&this._onValueChange(e),c!==a.value&&this._onValueChange(a)}_updateMaxNonRange(t){let e=this._getInput(m.END);if(e){let a=e.value;e.max=t,e._updateThumbUIByValue(),this._updateTrackUI(e),a!==e.value&&this._onValueChange(e)}}get step(){return this._step}set step(t){let e=isNaN(t)?this._step:t;this._step!==e&&this._updateStep(e)}_step=1;_updateStep(t){this._step=t,this._isRange?this._updateStepRange():this._updateStepNonRange(),this._onMinMaxOrStepChange()}_updateStepRange(){let t=this._getInput(m.END),e=this._getInput(m.START),a=t.value,l=e.value,c=e.value;t.min=this._min,e.max=this._max,t.step=this._step,e.step=this._step,this._platform.SAFARI&&(t.value=t.value,e.value=e.value),t.min=Math.max(this._min,e.value),e.max=Math.min(this._max,t.value),e._updateWidthInactive(),t._updateWidthInactive(),t.value<c?this._onTranslateXChangeBySideEffect(e,t):this._onTranslateXChangeBySideEffect(t,e),a!==t.value&&this._onValueChange(t),l!==e.value&&this._onValueChange(e)}_updateStepNonRange(){let t=this._getInput(m.END);if(t){let e=t.value;t.step=this._step,this._platform.SAFARI&&(t.value=t.value),t._updateThumbUIByValue(),e!==t.value&&this._onValueChange(t)}}displayWith=t=>`${t}`;_tickMarks;_noopAnimations=xt$1();_resizeObserver=null;_cachedWidth;_cachedLeft;_rippleRadius=24;startValueIndicatorText=``;endValueIndicatorText=``;_endThumbTransform;_startThumbTransform;_isRange=!1;_isRtl=ve(()=>this._dir?.valueSignal()===`rtl`);_hasViewInitialized=!1;_tickMarkTrackWidth=0;_hasAnimation=!1;_resizeTimer=null;_platform=f(Y);constructor(){f(Oe$1).load(sb);let t=this._isRtl();tR(()=>{let e=this._isRtl();e!==t&&(t=e,this._isRange?this._onDirChangeRange():this._onDirChangeNonRange(),this._updateTickMarkUI())})}_knobRadius=8;_inputPadding;ngAfterViewInit(){this._platform.isBrowser&&this._updateDimensions();let t=this._getInput(m.END),e=this._getInput(m.START);this._isRange=!!t&&!!e,this._cdr.detectChanges();let a=this._getThumb(m.END);this._rippleRadius=a._ripple.radius,this._inputPadding=this._rippleRadius-this._knobRadius,this._isRange?this._initUIRange(t,e):this._initUINonRange(t),this._updateTrackUI(t),this._updateTickMarkUI(),this._updateTickMarkTrackUI(),this._observeHostResize(),this._cdr.detectChanges()}_initUINonRange(t){t.initProps(),t.initUI(),this._updateValueIndicatorUI(t),this._hasViewInitialized=!0,t._updateThumbUIByValue()}_initUIRange(t,e){t.initProps(),t.initUI(),e.initProps(),e.initUI(),t._updateMinMax(),e._updateMinMax(),t._updateStaticStyles(),e._updateStaticStyles(),this._updateValueIndicatorUIs(),this._hasViewInitialized=!0,t._updateThumbUIByValue(),e._updateThumbUIByValue()}ngOnDestroy(){this._resizeObserver?.disconnect(),this._resizeObserver=null}_onDirChangeRange(){let t=this._getInput(m.END),e=this._getInput(m.START);t._setIsLeftThumb(),e._setIsLeftThumb(),t.translateX=t._calcTranslateXByValue(),e.translateX=e._calcTranslateXByValue(),t._updateStaticStyles(),e._updateStaticStyles(),t._updateWidthInactive(),e._updateWidthInactive(),t._updateThumbUIByValue(),e._updateThumbUIByValue()}_onDirChangeNonRange(){this._getInput(m.END)._updateThumbUIByValue()}_observeHostResize(){typeof ResizeObserver>`u`||!ResizeObserver||this._ngZone.runOutsideAngular(()=>{this._resizeObserver=new ResizeObserver(()=>{this._isActive()||(this._resizeTimer&&clearTimeout(this._resizeTimer),this._onResize())}),this._resizeObserver.observe(this._elementRef.nativeElement)})}_isActive(){return this._getThumb(m.START)._isActive||this._getThumb(m.END)._isActive}_getValue(t=m.END){let e=this._getInput(t);return e?e.value:this.min}_skipUpdate(){return!!(this._getInput(m.START)?._skipUIUpdate||this._getInput(m.END)?._skipUIUpdate)}_updateDimensions(){this._cachedWidth=this._elementRef.nativeElement.offsetWidth,this._cachedLeft=this._elementRef.nativeElement.getBoundingClientRect().left}_setTrackActiveStyles(t){let e=this._trackActive.nativeElement.style;e.left=t.left,e.right=t.right,e.transformOrigin=t.transformOrigin,e.transform=t.transform}_calcTickMarkTransform(t){let e=t*(this._tickMarkTrackWidth/(this._tickMarks.length-1));return`translateX(${this._isRtl()?this._cachedWidth-6-e:e}px)`}_onTranslateXChange(t){this._hasViewInitialized&&(this._updateThumbUI(t),this._updateTrackUI(t),this._updateOverlappingThumbUI(t))}_onTranslateXChangeBySideEffect(t,e){this._hasViewInitialized&&(t._updateThumbUIByValue(),e._updateThumbUIByValue())}_onValueChange(t){this._hasViewInitialized&&(this._updateValueIndicatorUI(t),this._updateTickMarkUI(),this._cdr.detectChanges())}_onMinMaxOrStepChange(){this._hasViewInitialized&&(this._updateTickMarkUI(),this._updateTickMarkTrackUI(),this._cdr.markForCheck())}_onResize(){if(this._hasViewInitialized){if(this._updateDimensions(),this._isRange){let t=this._getInput(m.END),e=this._getInput(m.START);t._updateThumbUIByValue(),e._updateThumbUIByValue(),t._updateStaticStyles(),e._updateStaticStyles(),t._updateMinMax(),e._updateMinMax(),t._updateWidthInactive(),e._updateWidthInactive()}else{let t=this._getInput(m.END);t&&t._updateThumbUIByValue()}this._updateTickMarkUI(),this._updateTickMarkTrackUI(),this._cdr.detectChanges()}}_thumbsOverlap=!1;_areThumbsOverlapping(){let t=this._getInput(m.START),e=this._getInput(m.END);return!t||!e?!1:e.translateX-t.translateX<20}_updateOverlappingThumbClassNames(t){let e=t.getSibling(),a=this._getThumb(t.thumbPosition);this._getThumb(e.thumbPosition)._hostElement.classList.remove(`mdc-slider__thumb--top`),a._hostElement.classList.toggle(`mdc-slider__thumb--top`,this._thumbsOverlap)}_updateOverlappingThumbUI(t){!this._isRange||this._skipUpdate()||this._thumbsOverlap!==this._areThumbsOverlapping()&&(this._thumbsOverlap=!this._thumbsOverlap,this._updateOverlappingThumbClassNames(t))}_updateThumbUI(t){if(this._skipUpdate())return;let e=this._getThumb(t.thumbPosition===m.END?m.END:m.START);e._hostElement.style.transform=`translateX(${t.translateX}px)`}_updateValueIndicatorUI(t){if(this._skipUpdate())return;let e=this.displayWith(t.value);if(this._hasViewInitialized?t._valuetext.set(e):t._hostElement.setAttribute(`aria-valuetext`,e),this.discrete){t.thumbPosition===m.START?this.startValueIndicatorText=e:this.endValueIndicatorText=e;let a=this._getThumb(t.thumbPosition);e.length<3?a._hostElement.classList.add(`mdc-slider__thumb--short-value`):a._hostElement.classList.remove(`mdc-slider__thumb--short-value`)}}_updateValueIndicatorUIs(){let t=this._getInput(m.END),e=this._getInput(m.START);t&&this._updateValueIndicatorUI(t),e&&this._updateValueIndicatorUI(e)}_updateTickMarkTrackUI(){if(!this.showTickMarks||this._skipUpdate())return;let t=this._step&&this._step>0?this._step:1,a=(Math.floor(this.max/t)*t-this.min)/(this.max-this.min);this._tickMarkTrackWidth=(this._cachedWidth-6)*a}_updateTrackUI(t){this._skipUpdate()||(this._isRange?this._updateTrackUIRange(t):this._updateTrackUINonRange(t))}_updateTrackUIRange(t){let e=t.getSibling();if(!e||!this._cachedWidth)return;let a=Math.abs(e.translateX-t.translateX)/this._cachedWidth;t._isLeftThumb&&this._cachedWidth?this._setTrackActiveStyles({left:`auto`,right:`${this._cachedWidth-e.translateX}px`,transformOrigin:`right`,transform:`scaleX(${a})`}):this._setTrackActiveStyles({left:`${e.translateX}px`,right:`auto`,transformOrigin:`left`,transform:`scaleX(${a})`})}_updateTrackUINonRange(t){this._isRtl()?this._setTrackActiveStyles({left:`auto`,right:`0px`,transformOrigin:`right`,transform:`scaleX(${1-t.fillPercentage})`}):this._setTrackActiveStyles({left:`0px`,right:`auto`,transformOrigin:`left`,transform:`scaleX(${t.fillPercentage})`})}_updateTickMarkUI(){if(!this.showTickMarks||this.step===void 0||this.min===void 0||this.max===void 0)return;let t=this.step>0?this.step:1;this._isRange?this._updateTickMarkUIRange(t):this._updateTickMarkUINonRange(t)}_updateTickMarkUINonRange(t){let e=this._getValue(),a=Math.max(Math.round((e-this.min)/t),0)+1,l=Math.max(Math.round((this.max-e)/t),0)-1;this._isRtl()?a++:l++,this._tickMarks=Array(a).fill(H.ACTIVE).concat(Array(l).fill(H.INACTIVE))}_updateTickMarkUIRange(t){let e=this._getValue(),a=this._getValue(m.START),l=Math.max(Math.round((a-this.min)/t),0),c=Math.max(Math.round((e-a)/t)+1,0),v=Math.max(Math.round((this.max-e)/t),0);this._tickMarks=Array(l).fill(H.INACTIVE).concat(Array(c).fill(H.ACTIVE),Array(v).fill(H.INACTIVE))}_getInput(t){if(t===m.END&&this._input)return this._input;if(this._inputs?.length)return t===m.START?this._inputs.first:this._inputs.last}_getThumb(t){return t===m.END?this._thumbs?.last:this._thumbs?.first}_setTransition(t){this._hasAnimation=!this._platform.IOS&&t&&!this._noopAnimations,this._elementRef.nativeElement.classList.toggle(`mat-mdc-slider-with-animation`,this._hasAnimation)}_isCursorOnSliderThumb(t,e){let a=e.width/2,l=e.x+a,c=e.y+a,v=t.clientX-l,p=t.clientY-c;return Math.pow(v,2)+Math.pow(p,2)<Math.pow(a,2)}static ɵfac=function(e){return new(e||n)};static ɵcmp=(function(){let t=[`trackActive`],e=[`*`];function a(p,x){if(p&1&&Ds(0,`div`),p&2){let _=x.$implicit,I=x.$index,F=Es(3);dd(_===0?`mdc-slider__tick-mark--active`:`mdc-slider__tick-mark--inactive`),ld(`transform`,F._calcTickMarkTransform(I))}}function l(p,x){if(p&1&&BE(0,a,1,4,`div`,8,LE),p&2){let _=Es(2);jE(_._tickMarks)}}function c(p,x){if(p&1&&(Wt(0,`div`,6,1),Gt(2,l,2,0),Yt()),p&2){let _=Es();ke$1(2),qt(_._cachedWidth?2:-1)}}function v(p,x){if(p&1&&Ds(0,`mat-slider-visual-thumb`,7),p&2){let _=Es();Ch(`discrete`,_.discrete)(`thumbPosition`,1)(`valueIndicatorText`,_.startValueIndicatorText)}}return ie({type:n,selectors:[[`mat-slider`]],contentQueries:function(x,_,I){if(x&1&&kh(I,ye,5)(I,Oe,4),x&2){let F;Sr(F=Ir())&&(_._input=F.first),Sr(F=Ir())&&(_._inputs=F)}},viewQuery:function(x,_){if(x&1&&Cr(t,5)(xe,5),x&2){let I;Sr(I=Ir())&&(_._trackActive=I.first),Sr(I=Ir())&&(_._thumbs=I)}},hostAttrs:[1,`mat-mdc-slider`,`mdc-slider`],hostVars:12,hostBindings:function(x,_){x&2&&(dd(`mat-`+(_.color||`primary`)),Ce$1(`mdc-slider--range`,_._isRange)(`mdc-slider--disabled`,_.disabled)(`mdc-slider--discrete`,_.discrete)(`mdc-slider--tick-marks`,_.showTickMarks)(`_mat-animation-noopable`,_._noopAnimations))},inputs:{disabled:[2,`disabled`,`disabled`,Re$1],discrete:[2,`discrete`,`discrete`,Re$1],showTickMarks:[2,`showTickMarks`,`showTickMarks`,Re$1],min:[2,`min`,`min`,Ed],color:`color`,disableRipple:[2,`disableRipple`,`disableRipple`,Re$1],max:[2,`max`,`max`,Ed],step:[2,`step`,`step`,Ed],displayWith:`displayWith`},exportAs:[`matSlider`],features:[Kh([{provide:yt,useExisting:n}])],ngContentSelectors:e,decls:9,vars:5,consts:[[`trackActive`,``],[`tickMarkContainer`,``],[1,`mdc-slider__track`],[1,`mdc-slider__track--inactive`],[1,`mdc-slider__track--active`],[1,`mdc-slider__track--active_fill`],[1,`mdc-slider__tick-marks`],[3,`discrete`,`thumbPosition`,`valueIndicatorText`],[3,`class`,`transform`]],template:function(x,_){x&1&&(xn(),be(0),Wt(1,`div`,2),Ds(2,`div`,3),Wt(3,`div`,4),Ds(4,`div`,5,0),Yt(),Gt(6,c,3,1,`div`,6),Yt(),Gt(7,v,1,3,`mat-slider-visual-thumb`,7),Ds(8,`mat-slider-visual-thumb`,7)),x&2&&(ke$1(6),qt(_.showTickMarks?6:-1),ke$1(),qt(_._isRange?7:-1),ke$1(),Ch(`discrete`,_.discrete)(`thumbPosition`,2)(`valueIndicatorText`,_.endValueIndicatorText))},dependencies:[Le],styles:[`.mdc-slider__track {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 100%;
  pointer-events: none;
  height: var(--%NS%mat-slider-inactive-track-height, 4px);
}

.mdc-slider__track--active,
.mdc-slider__track--inactive {
  display: flex;
  height: 100%;
  position: absolute;
  width: 100%;
}

.mdc-slider__track--active {
  overflow: hidden;
  border-radius: var(--%NS%mat-slider-active-track-shape, var(--%NS%mat-sys-corner-full));
  height: var(--%NS%mat-slider-active-track-height, 4px);
  top: calc((var(--%NS%mat-slider-inactive-track-height, 4px) - var(--%NS%mat-slider-active-track-height, 4px)) / 2);
}

.mdc-slider__track--active_fill {
  border-top-style: solid;
  box-sizing: border-box;
  height: 100%;
  width: 100%;
  position: relative;
  transform-origin: left;
  transition: transform 80ms ease;
  border-color: var(--%NS%mat-slider-active-track-color, var(--%NS%mat-sys-primary));
  border-top-width: var(--%NS%mat-slider-active-track-height, 4px);
}
.mdc-slider--disabled .mdc-slider__track--active_fill {
  border-color: var(--%NS%mat-slider-disabled-active-track-color, var(--%NS%mat-sys-on-surface));
}
[dir=rtl] .mdc-slider__track--active_fill {
  -webkit-transform-origin: right;
  transform-origin: right;
}

.mdc-slider__track--inactive {
  left: 0;
  top: 0;
  opacity: 0.24;
  background-color: var(--%NS%mat-slider-inactive-track-color, var(--%NS%mat-sys-surface-variant));
  height: var(--%NS%mat-slider-inactive-track-height, 4px);
  border-radius: var(--%NS%mat-slider-inactive-track-shape, var(--%NS%mat-sys-corner-full));
}
.mdc-slider--disabled .mdc-slider__track--inactive {
  background-color: var(--%NS%mat-slider-disabled-inactive-track-color, var(--%NS%mat-sys-on-surface));
  opacity: 0.24;
}
.mdc-slider__track--%NS%inactive::before {
  position: absolute;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  border: 1px solid transparent;
  border-radius: inherit;
  content: "";
  pointer-events: none;
}
@media (forced-colors: active) {
  .mdc-slider__track--%NS%inactive::before {
    border-color: CanvasText;
  }
}

.mdc-slider__value-indicator-container {
  bottom: 44px;
  left: 50%;
  pointer-events: none;
  position: absolute;
  transform: var(--%NS%mat-slider-value-indicator-container-transform, translateX(-50%) rotate(-45deg));
}
.mdc-slider__thumb--with-indicator .mdc-slider__value-indicator-container {
  pointer-events: auto;
}

.mdc-slider__value-indicator {
  display: flex;
  align-items: center;
  transform: scale(0);
  transform-origin: var(--%NS%mat-slider-value-indicator-transform-origin, 0 28px);
  transition: transform 100ms cubic-bezier(0.4, 0, 1, 1);
  word-break: normal;
  background-color: var(--%NS%mat-slider-label-container-color, var(--%NS%mat-sys-primary));
  color: var(--%NS%mat-slider-label-label-text-color, var(--%NS%mat-sys-on-primary));
  width: var(--%NS%mat-slider-value-indicator-width, 28px);
  height: var(--%NS%mat-slider-value-indicator-height, 28px);
  padding: var(--%NS%mat-slider-value-indicator-padding, 0);
  opacity: var(--%NS%mat-slider-value-indicator-opacity, 1);
  border-radius: var(--%NS%mat-slider-value-indicator-border-radius, 50% 50% 50% 0);
}
.mdc-slider__thumb--with-indicator .mdc-slider__value-indicator {
  transition: transform 100ms cubic-bezier(0, 0, 0.2, 1);
  transform: scale(1);
}
.mdc-slider__value-indicator::before {
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid;
  bottom: -5px;
  content: "";
  height: 0;
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
  width: 0;
  display: var(--%NS%mat-slider-value-indicator-caret-display, none);
  border-top-color: var(--%NS%mat-slider-label-container-color, var(--%NS%mat-sys-primary));
}
.mdc-slider__value-indicator::after {
  position: absolute;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  border: 1px solid transparent;
  border-radius: inherit;
  content: "";
  pointer-events: none;
}
@media (forced-colors: active) {
  .mdc-slider__value-indicator::after {
    border-color: CanvasText;
  }
}

.mdc-slider__value-indicator-text {
  text-align: center;
  width: var(--%NS%mat-slider-value-indicator-width, 28px);
  transform: var(--%NS%mat-slider-value-indicator-text-transform, rotate(45deg));
  font-family: var(--%NS%mat-slider-label-label-text-font, var(--%NS%mat-sys-label-medium-font));
  font-size: var(--%NS%mat-slider-label-label-text-size, var(--%NS%mat-sys-label-medium-size));
  font-weight: var(--%NS%mat-slider-label-label-text-weight, var(--%NS%mat-sys-label-medium-weight));
  line-height: var(--%NS%mat-slider-label-label-text-line-height, var(--%NS%mat-sys-label-medium-line-height));
  letter-spacing: var(--%NS%mat-slider-label-label-text-tracking, var(--%NS%mat-sys-label-medium-tracking));
}

.mdc-slider__thumb {
  -webkit-user-select: none;
  user-select: none;
  display: flex;
  left: -24px;
  outline: none;
  position: absolute;
  height: 48px;
  width: 48px;
  pointer-events: none;
}
.mdc-slider--discrete .mdc-slider__thumb {
  transition: transform 80ms ease;
}
.mdc-slider--disabled .mdc-slider__thumb {
  pointer-events: none;
}

.mdc-slider__thumb--top {
  z-index: 1;
}

.mdc-slider__thumb-knob {
  position: absolute;
  box-sizing: border-box;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  border-style: solid;
  width: var(--%NS%mat-slider-handle-width, 20px);
  height: var(--%NS%mat-slider-handle-height, 20px);
  border-width: calc(var(--%NS%mat-slider-handle-height, 20px) / 2) calc(var(--%NS%mat-slider-handle-width, 20px) / 2);
  box-shadow: var(--%NS%mat-slider-handle-elevation, var(--%NS%mat-sys-level1));
  background-color: var(--%NS%mat-slider-handle-color, var(--%NS%mat-sys-primary));
  border-color: var(--%NS%mat-slider-handle-color, var(--%NS%mat-sys-primary));
  border-radius: var(--%NS%mat-slider-handle-shape, var(--%NS%mat-sys-corner-full));
}
.mdc-slider__thumb:hover .mdc-slider__thumb-knob {
  background-color: var(--%NS%mat-slider-hover-handle-color, var(--%NS%mat-sys-primary));
  border-color: var(--%NS%mat-slider-hover-handle-color, var(--%NS%mat-sys-primary));
}
.mdc-slider__thumb--focused .mdc-slider__thumb-knob {
  background-color: var(--%NS%mat-slider-focus-handle-color, var(--%NS%mat-sys-primary));
  border-color: var(--%NS%mat-slider-focus-handle-color, var(--%NS%mat-sys-primary));
}
.mdc-slider--disabled .mdc-slider__thumb-knob {
  background-color: var(--%NS%mat-slider-disabled-handle-color, var(--%NS%mat-sys-on-surface));
  border-color: var(--%NS%mat-slider-disabled-handle-color, var(--%NS%mat-sys-on-surface));
}
.mdc-slider__thumb--top .mdc-slider__thumb-knob, .mdc-slider__thumb--top.mdc-slider__thumb:hover .mdc-slider__thumb-knob, .mdc-slider__thumb--top.mdc-slider__thumb--focused .mdc-slider__thumb-knob {
  border: solid 1px #fff;
  box-sizing: content-box;
  border-color: var(--%NS%mat-slider-with-overlap-handle-outline-color, var(--%NS%mat-sys-on-primary));
  border-width: var(--%NS%mat-slider-with-overlap-handle-outline-width, 1px);
}

.mdc-slider__tick-marks {
  align-items: center;
  box-sizing: border-box;
  display: flex;
  height: 100%;
  justify-content: space-between;
  padding: 0 1px;
  position: absolute;
  width: 100%;
}

.mdc-slider__tick-mark--active,
.mdc-slider__tick-mark--inactive {
  width: var(--%NS%mat-slider-with-tick-marks-container-size, 2px);
  height: var(--%NS%mat-slider-with-tick-marks-container-size, 2px);
  border-radius: var(--%NS%mat-slider-with-tick-marks-container-shape, var(--%NS%mat-sys-corner-full));
}

.mdc-slider__tick-mark--inactive {
  opacity: var(--%NS%mat-slider-with-tick-marks-inactive-container-opacity, 0.38);
  background-color: var(--%NS%mat-slider-with-tick-marks-inactive-container-color, var(--%NS%mat-sys-on-surface-variant));
}
.mdc-slider--disabled .mdc-slider__tick-mark--inactive {
  opacity: var(--%NS%mat-slider-with-tick-marks-inactive-container-opacity, 0.38);
  background-color: var(--%NS%mat-slider-with-tick-marks-disabled-container-color, var(--%NS%mat-sys-on-surface));
}

.mdc-slider__tick-mark--active {
  opacity: var(--%NS%mat-slider-with-tick-marks-active-container-opacity, 0.38);
  background-color: var(--%NS%mat-slider-with-tick-marks-active-container-color, var(--%NS%mat-sys-on-primary));
}

.mdc-slider__input {
  cursor: pointer;
  left: 2px;
  margin: 0;
  height: 44px;
  opacity: 0;
  position: absolute;
  top: 2px;
  width: 44px;
  box-sizing: content-box;
}
.mdc-slider__input.mat-mdc-slider-input-no-pointer-events {
  pointer-events: none;
}
.mdc-slider__input.mat-slider__right-input {
  left: auto;
  right: 0;
}

.mat-mdc-slider {
  display: inline-block;
  box-sizing: border-box;
  outline: none;
  vertical-align: middle;
  cursor: pointer;
  height: 48px;
  margin: 0 8px;
  position: relative;
  touch-action: pan-y;
  width: auto;
  min-width: 112px;
  -webkit-tap-highlight-color: transparent;
}
.mat-mdc-slider.mdc-slider--disabled {
  cursor: auto;
  opacity: 0.38;
}
.mat-mdc-slider.mdc-slider--disabled .mdc-slider__input {
  cursor: auto;
}
.mat-mdc-slider .mdc-slider__thumb,
.mat-mdc-slider .mdc-slider__track--active_fill {
  transition-duration: 0ms;
}
.mat-mdc-slider.mat-mdc-slider-with-animation .mdc-slider__thumb,
.mat-mdc-slider.mat-mdc-slider-with-animation .mdc-slider__track--active_fill {
  transition-duration: 80ms;
}
.mat-mdc-slider.mdc-slider--discrete .mdc-slider__thumb,
.mat-mdc-slider.mdc-slider--discrete .mdc-slider__track--active_fill {
  transition-duration: 0ms;
}
.mat-mdc-slider.mat-mdc-slider-with-animation .mdc-slider__thumb,
.mat-mdc-slider.mat-mdc-slider-with-animation .mdc-slider__track--active_fill {
  transition-duration: 80ms;
}
.mat-mdc-slider .mat-ripple .mat-ripple-element {
  background-color: var(--%NS%mat-slider-ripple-color, var(--%NS%mat-sys-primary));
}
.mat-mdc-slider .mat-ripple .mat-mdc-slider-hover-ripple {
  background-color: var(--%NS%mat-slider-hover-state-layer-color, color-mix(in srgb, var(--%NS%mat-sys-primary) 5%, transparent));
}
.mat-mdc-slider .mat-ripple .mat-mdc-slider-focus-ripple,
.mat-mdc-slider .mat-ripple .mat-mdc-slider-active-ripple {
  background-color: var(--%NS%mat-slider-focus-state-layer-color, color-mix(in srgb, var(--%NS%mat-sys-primary) 20%, transparent));
}
.mat-mdc-slider._mat-animation-noopable.mdc-slider--discrete .mdc-slider__thumb, .mat-mdc-slider._mat-animation-noopable.mdc-slider--discrete .mdc-slider__track--active_fill,
.mat-mdc-slider._mat-animation-noopable .mdc-slider__value-indicator {
  transition: none;
}
.mat-mdc-slider .mat-focus-indicator::before {
  border-radius: 50%;
}

.mdc-slider__thumb--focused .mat-focus-indicator::before {
  content: "";
}
`],encapsulation:2})})()}return n})();var Ue={provide:Be$1,useExisting:jo(()=>xt),multi:!0};var xt=(()=>{class n{_ngZone=f(M);_elementRef=f(G);_cdr=f(xr);_slider=f(yt);_platform=f(Y);_listenerCleanups;get value(){return Ed(this._hostElement.value,0)}set value(t){t===null&&(t=this._getDefaultValue()),t=isNaN(t)?0:t;let e=t+``;if(!this._hasSetInitialValue){this._initialValue=e;return}this._isActive||this._setValue(e)}_setValue(t){this._hostElement.value=t,this._updateThumbUIByValue(),this._slider._onValueChange(this),this._cdr.detectChanges(),this._slider._cdr.markForCheck()}valueChange=new pe;dragStart=new pe;dragEnd=new pe;get translateX(){return this._slider.min>=this._slider.max?(this._translateX=this._tickMarkOffset,this._translateX):(this._translateX===void 0&&(this._translateX=this._calcTranslateXByValue()),this._translateX)}set translateX(t){this._translateX=t}_translateX;thumbPosition=m.END;get min(){return Ed(this._hostElement.min,0)}set min(t){this._hostElement.min=t+``,this._cdr.detectChanges()}get max(){return Ed(this._hostElement.max,0)}set max(t){this._hostElement.max=t+``,this._cdr.detectChanges()}get step(){return Ed(this._hostElement.step,0)}set step(t){this._hostElement.step=t+``,this._cdr.detectChanges()}get disabled(){return Re$1(this._hostElement.disabled)}set disabled(t){this._hostElement.disabled=t,this._cdr.detectChanges(),this._slider.disabled!==this.disabled&&(this._slider.disabled=this.disabled)}get percentage(){return this._slider.min>=this._slider.max?this._slider._isRtl()?1:0:(this.value-this._slider.min)/(this._slider.max-this._slider.min)}get fillPercentage(){return this._slider._cachedWidth?this._translateX===0?0:this.translateX/this._slider._cachedWidth:this._slider._isRtl()?1:0}_hostElement=this._elementRef.nativeElement;_valuetext=X(``);_knobRadius=8;_tickMarkOffset=3;_isActive=!1;_isFocused=!1;_setIsFocused(t){this._isFocused=t}_hasSetInitialValue=!1;_initialValue;_formControl;_destroyed=new T;_skipUIUpdate=!1;_onChangeFn;_onTouchedFn=()=>{};_isControlInitialized=!1;constructor(){let t=f(ze$1);this._ngZone.runOutsideAngular(()=>{this._listenerCleanups=[t.listen(this._hostElement,`pointerdown`,this._onPointerDown.bind(this)),t.listen(this._hostElement,`pointermove`,this._onPointerMove.bind(this)),t.listen(this._hostElement,`pointerup`,this._onPointerUp.bind(this))]})}ngOnDestroy(){this._listenerCleanups.forEach(t=>t()),this._destroyed.next(),this._destroyed.complete(),this.dragStart.complete(),this.dragEnd.complete()}initProps(){this._updateWidthInactive(),this.disabled!==this._slider.disabled&&(this._slider.disabled=!0),this.step=this._slider.step,this.min=this._slider.min,this.max=this._slider.max,this._initValue()}initUI(){this._updateThumbUIByValue()}_initValue(){this._hasSetInitialValue=!0,this._initialValue===void 0?this.value=this._getDefaultValue():(this._hostElement.value=this._initialValue,this._updateThumbUIByValue(),this._slider._onValueChange(this),this._cdr.detectChanges())}_getDefaultValue(){return this.min}_onBlur(){this._setIsFocused(!1),this._onTouchedFn()}_onFocus(){this._slider._setTransition(!1),this._slider._updateTrackUI(this),this._setIsFocused(!0)}_onChange(){this.valueChange.emit(this.value),this._isActive&&this._updateThumbUIByValue({withAnimation:!0})}_onInput(){this._onChangeFn?.(this.value),(this._slider.step||!this._isActive)&&this._updateThumbUIByValue({withAnimation:!this._isActive}),this._slider._onValueChange(this)}_onNgControlValueChange(){(!this._isActive||!this._isFocused)&&(this._slider._onValueChange(this),this._updateThumbUIByValue()),this._slider.disabled=this._formControl.disabled}_onPointerDown(t){if(!(this.disabled||t.button!==0)){if(this._platform.IOS){let e=this._slider._isCursorOnSliderThumb(t,this._slider._getThumb(this.thumbPosition)._hostElement.getBoundingClientRect());this._isActive=e,this._updateWidthActive(),this._slider._updateDimensions();return}this._isActive=!0,this._setIsFocused(!0),this._updateWidthActive(),this._slider._updateDimensions(),this._slider.step||this._updateThumbUIByPointerEvent(t,{withAnimation:!0}),this.disabled||(this._handleValueCorrection(t),this.dragStart.emit({source:this,parent:this._slider,value:this.value}))}}_handleValueCorrection(t){this._skipUIUpdate=!0,setTimeout(()=>{this._skipUIUpdate=!1,this._fixValue(t)},0)}_fixValue(t){let e=t.clientX-this._slider._cachedLeft,a=this._slider._cachedWidth,l=this._slider.step===0?1:this._slider.step,c=Math.floor((this._slider.max-this._slider.min)/l),v=this._slider._isRtl()?1-e/a:e/a,x=Math.round(v*c)/c*(this._slider.max-this._slider.min)+this._slider.min,_=Math.round(x/l)*l;if(_===this.value){this._slider._onValueChange(this),this._slider.step>0?this._updateThumbUIByValue():this._updateThumbUIByPointerEvent(t,{withAnimation:this._slider._hasAnimation});return}this.value=_,this.valueChange.emit(this.value),this._onChangeFn?.(this.value),this._slider._onValueChange(this),this._slider.step>0?this._updateThumbUIByValue():this._updateThumbUIByPointerEvent(t,{withAnimation:this._slider._hasAnimation})}_onPointerMove(t){!this._slider.step&&this._isActive&&this._updateThumbUIByPointerEvent(t)}_onPointerUp(){this._isActive&&(this._isActive=!1,this._platform.SAFARI&&this._setIsFocused(!1),this.dragEnd.emit({source:this,parent:this._slider,value:this.value}),setTimeout(()=>this._updateWidthInactive(),this._platform.IOS?10:0))}_clamp(t){let e=this._tickMarkOffset,a=this._slider._cachedWidth-this._tickMarkOffset;return Math.max(Math.min(t,a),e)}_calcTranslateXByValue(){return this._slider._isRtl()?(1-this.percentage)*(this._slider._cachedWidth-this._tickMarkOffset*2)+this._tickMarkOffset:this.percentage*(this._slider._cachedWidth-this._tickMarkOffset*2)+this._tickMarkOffset}_calcTranslateXByPointerEvent(t){return t.clientX-this._slider._cachedLeft}_updateWidthActive(){}_updateWidthInactive(){this._hostElement.style.padding=`0 ${this._slider._inputPadding}px`,this._hostElement.style.width=`calc(100% + ${this._slider._inputPadding-this._tickMarkOffset*2}px)`,this._hostElement.style.left=`-${this._slider._rippleRadius-this._tickMarkOffset}px`}_updateThumbUIByValue(t){this.translateX=this._clamp(this._calcTranslateXByValue()),this._updateThumbUI(t)}_updateThumbUIByPointerEvent(t,e){this.translateX=this._clamp(this._calcTranslateXByPointerEvent(t)),this._updateThumbUI(e)}_updateThumbUI(t){this._slider._setTransition(!!t?.withAnimation),this._slider._onTranslateXChange(this)}writeValue(t){(this._isControlInitialized||t!==null)&&(this.value=t)}registerOnChange(t){this._onChangeFn=t,this._isControlInitialized=!0}registerOnTouched(t){this._onTouchedFn=t}setDisabledState(t){this.disabled=t}focus(){this._hostElement.focus()}blur(){this._hostElement.blur()}static ɵfac=function(e){return new(e||n)};static ɵdir=se({type:n,selectors:[[`input`,`matSliderThumb`,``]],hostAttrs:[`type`,`range`,1,`mdc-slider__input`],hostVars:1,hostBindings:function(e,a){e&1&&wr(`change`,function(){return a._onChange()})(`input`,function(){return a._onInput()})(`blur`,function(){return a._onBlur()})(`focus`,function(){return a._onFocus()}),e&2&&ho(`aria-valuetext`,a._valuetext())},inputs:{value:[2,`value`,`value`,Ed]},outputs:{valueChange:`valueChange`,dragStart:`dragStart`,dragEnd:`dragEnd`},exportAs:[`matSliderThumb`],features:[Kh([Ue,{provide:ye,useExisting:n}])]})}return n})();function Be(n,i){if(n&1&&(Wt(0,`p`,10),ws(1),Yt()),n&2){let t=Es();ke$1(),go(` You’re the only Peach here, so every week would be a bye. Share invite code `,t.crate.inviteCode,` first: who plays is fixed when the Season is scheduled. `)}}function Fe(n){let i=Uc(n);return[{value:i,label:`This week`},{value:nt(i,7),label:`Next week`}]}var ht=class n{state=f(Rb);ref=f(A$1);crate=f(qt$1);startOptions=Fe(this.state.today());maxWeeks=12;name=X(`New Season`);startWeek=X(this.startOptions[1].value);weeks=X(6);busy=X(!1);rules=this.state.query(()=>this.crate.id,(i,t)=>t.votingService.currentRules(i)).value;alone=ve(()=>this.memberCount()===1);memberCount=this.state.query(()=>this.crate.id,async(i,t)=>(await t.crateService.activeMembers(i)).length).value;dates=ve(()=>{let i=this.startWeek();return i?`${g$1.day(i)} \u2013 ${g$1.day(nt(i,this.weeks()*7-1))}`:``});rulesLine=ve(()=>{let i=this.rules();if(!i)return`…`;let t=i.weights,e=s.filter(p=>t[p]>0).sort((p,x)=>t[x]-t[p]).map(p=>`${g$1.category(p)} ${t[p]}`).join(`, `),{slots:a,pledgeBonus:l,battlePars:c}=i.lineup;return`${e}; ${a===0?`no lineups`:`lineups of ${a} with +${l}% pledges and ${g$1.count(c,`par`)} per battle`}`});onName(i){this.name.set(i.target.value)}async start(){let i=this.startWeek();if(this.busy()||!i)return;this.busy.set(!0);let t=await this.state.run(e=>e.seasonService.createSeason({crate:this.crate,name:this.name(),startWeek:i,weeks:this.weeks(),now:this.state.now()}));t&&await this.state.syncSeasons(),this.busy.set(!1),t&&this.ref.close(t)}static ɵfac=function(t){return new(t||n)};static ɵcmp=ie({type:n,selectors:[[`pch-new-season-dialog`]],decls:24,vars:12,consts:[[`mat-dialog-title`,``],[1,`fields`],[`appearance`,`outline`],[`matInput`,``,`autocomplete`,`off`,3,`input`,`value`],[`id`,`season-start-label`,1,`pch-body-large`,`label`],[`aria-labelledby`,`season-start-label`,3,`selectedChange`,`options`,`selected`],[`id`,`season-length-label`,1,`pch-body-large`,`label`,`length`],[1,`pch-body-medium`,`muted`,`dates`],[`min`,`1`,`step`,`1`,`discrete`,``,3,`max`],[`matSliderThumb`,``,`aria-labelledby`,`season-length-label`,3,`valueChange`,`value`],[`role`,`note`,1,`pch-body-medium`,`alone`],[1,`pch-body-medium`,`muted`],[`align`,`end`],[`matButton`,``,`type`,`button`,`mat-dialog-close`,``,3,`disabled`],[`matButton`,`filled`,`type`,`button`,3,`click`,`disabled`]],template:function(t,e){t&1&&(Wt(0,`h2`,0),ws(1,`New Season`),Yt(),Wt(2,`mat-dialog-content`,1)(3,`mat-form-field`,2)(4,`mat-label`),ws(5,`Name`),Yt(),Wt(6,`input`,3),wr(`input`,function(l){return e.onName(l)}),Yt()(),Wt(7,`p`,4),ws(8,`Starts`),Yt(),Wt(9,`pch-button-group`,5),Wh(`selectedChange`,function(l){return _w(e.startWeek,l)||(e.startWeek=l),l}),Yt(),Wt(10,`p`,6),ws(11),Yt(),Wt(12,`p`,7),ws(13),Yt(),Wt(14,`mat-slider`,8)(15,`input`,9),wr(`valueChange`,function(l){return e.weeks.set(l)}),Yt()(),Gt(16,Be,2,1,`p`,10),Wt(17,`p`,11),ws(18),Yt()(),Wt(19,`mat-dialog-actions`,12)(20,`button`,13),ws(21,`Cancel`),Yt(),Wt(22,`button`,14),wr(`click`,function(){return e.start()}),ws(23,` Start `),Yt()()),t&2&&(ke$1(6),Ch(`value`,e.name()),ke$1(3),Ch(`options`,e.startOptions),zh(`selected`,e.startWeek),ke$1(2),Uh(` Length: `,e.weeks(),` `,e.weeks()===1?`week`:`weeks`,` `),ke$1(2),Hh(e.dates()),ke$1(),Ch(`max`,e.maxWeeks),ke$1(),Ch(`value`,e.weeks()),ke$1(),qt(e.alone()?16:-1),ke$1(2),go(` One matchup a week; everything you log counts. From the Crate’s vote, frozen for the Season: `,e.rulesLine(),`. `),ke$1(2),Ch(`disabled`,e.busy()),ke$1(2),Ch(`disabled`,e.busy()||!e.startWeek()))},dependencies:[A,db,Be$2,Ne$1,Re$2,Pe$1,kt,Gi,be$1,Se,xt],styles:[`mat-dialog-content[_ngcontent-%COMP%]{display:flex;flex-direction:column}.fields.mat-mdc-dialog-content[_ngcontent-%COMP%]{padding-top:8px}.label[_ngcontent-%COMP%]{margin:0 0 8px}.length[_ngcontent-%COMP%]{margin-top:16px}mat-slider[_ngcontent-%COMP%]{margin-inline:0}.muted[_ngcontent-%COMP%]{margin:8px 0 0;color:var(--%NS%mat-sys-on-surface-variant)}.dates[_ngcontent-%COMP%]{margin:0}.alone[_ngcontent-%COMP%]{margin:8px 0 0;padding:12px 16px;border-radius:var(--%NS%pch-radius-medium);background:var(--%NS%mat-sys-tertiary-container);color:var(--%NS%mat-sys-on-tertiary-container)}`]})};var We=n=>[`/crates`,n,`vote`];var ze=(n,i)=>i.view.dispute.id;var $e=(n,i)=>i.round.id;var Ce=(n,i)=>i.id;var Xe=(n,i)=>i.peach.id;function He(n,i){n&1&&Ds(0,`pch-loading-indicator`,0)}function je(n,i){n&1&&(Wt(0,`pch-page`,1),Ds(1,`pch-empty-state`,3),Yt())}function qe(n,i){if(n&1){let t=cd();Wt(0,`button`,20),wr(`click`,function(){Ei(t);let a=Es(2),l=Ew(0);return wi(a.share(l))}),Wt(1,`span`,7),ws(2,`share`),Yt()()}}function Qe(n,i){if(n&1&&(Wt(0,`a`,23),Ds(1,`pch-dispute-card`,24),Yt()),n&2){let t=i.$implicit;Ch(`routerLink`,t.link),ke$1(),Ch(`view`,t.view)(`owner`,t.owner)(`openedBy`,t.openedBy)}}function Ge(n,i){if(n&1&&(Ds(0,`pch-section`,21),Wt(1,`div`,22),BE(2,Qe,2,4,`a`,23,ze),Yt()),n&2){let t=Es(2);Ch(`top`,8),ke$1(),Ch(`pchStagger`,0),ke$1(),jE(t.disputes())}}function Ye(n,i){n&1&&Ds(0,`pch-loading-indicator`,10),n&2&&Ch(`size`,40)}function Ze(n,i){if(n&1&&(Wt(0,`pch-card`,11),ws(1),Yt()),n&2){let t=Es(2);ke$1(),go(` No Season yet. `,t.canManage()?`Start one`:`The owner can start one`,`: every week you’re paired up, and whoever logs more points wins. `)}}function Ke(n,i){if(n&1&&Ds(0,`pch-standings-table`,27),n&2){Es();let t=Ew(3),e=Es(2);Ch(`pchStagger`,1)(`rows`,t)(`highlightPeachId`,e.me())}}function Je(n,i){n&1&&Ds(0,`pch-loading-indicator`,10),n&2&&Ch(`size`,40)}function ti(n,i){if(n&1&&(Wt(0,`a`,32),ws(1),Yt()),n&2){let t=Es().$implicit;Ch(`routerLink`,t.matchupLink),ke$1(),Hh(t.title)}}function ei(n,i){if(n&1&&ws(0),n&2){let t=Es().$implicit;go(` `,t.title,` `)}}function ii(n,i){if(n&1&&(Wt(0,`span`,33),ws(1),Yt()),n&2){let t=Es().$implicit;ke$1(),Hh(t.subtitle)}}function ni(n,i){if(n&1){let t=cd();Wt(0,`button`,37),wr(`click`,function(){Ei(t);let a=Es().$implicit,l=Es(4);return wi(l.runRound(a))}),ws(1),Yt()}if(n&2){let t=Es().$implicit,e=Es(4);Ch(`disabled`,e.busyRound()!==null),ho(`aria-label`,(t.action===`open`?`Open week `:`Close week `)+(t.round.index+1)),ke$1(),go(` `,t.action===`open`?`Open`:`Close`,` `)}}function ai(n,i){if(n&1&&(Wt(0,`pch-status-label`,36),ws(1),Yt()),n&2){let t=Es().$implicit,e=Es(4);Ch(`color`,e.roundStatusColor(t.round.status)),ke$1(),Hh(e.fmt.roundStatus(t.round.status))}}function ri(n,i){if(n&1&&(Wt(0,`pch-list-row`,30)(1,`span`,31),ws(2),Yt(),Gt(3,ti,2,2,`a`,32)(4,ei,1,1),Gt(5,ii,2,1,`span`,33),Wt(6,`span`,34),Gt(7,ni,2,3,`button`,35)(8,ai,2,2,`pch-status-label`,36),Yt()()),n&2){let t=i.$implicit;Ch(`interactive`,!!t.matchupLink),ke$1(),ho(`data-status`,t.round.status),ke$1(),Hh(t.round.index+1),ke$1(),qt(t.matchupLink?3:4),ke$1(2),qt(t.subtitle?5:-1),ke$1(2),qt(t.action?7:8)}}function si(n,i){if(n&1&&(Wt(0,`pch-list-card`,29),BE(1,ri,9,6,`pch-list-row`,30,$e),Yt()),n&2){Es();let t=Ew(7);Ch(`pchStagger`,2),ke$1(),jE(t)}}function oi(n,i){n&1&&Ds(0,`pch-loading-indicator`,10),n&2&&Ch(`size`,40)}function li(n,i){if(n&1&&(Wt(0,`pch-section`,25)(1,`pch-status-label`,26),ws(2),Yt()(),qh(3),Gt(4,Ke,1,3,`pch-standings-table`,27)(5,Je,1,1,`pch-loading-indicator`,10),Ds(6,`pch-section`,28),qh(7),Gt(8,si,3,1,`pch-list-card`,29)(9,oi,1,1,`pch-loading-indicator`,10)),n&2){Es();let t=Ew(16),e=Es();Ch(`title`,t.name),ke$1(),Ch(`color`,t.status===`active`?`primary`:void 0),ke$1(),Hh(e.fmt.seasonStatus(t.status)),ke$1();let a=Dw(e.standingRows());ke$1(),qt(a?4:5),ke$1(3);let l=Dw(e.rounds());ke$1(),qt(l?8:9)}}function di(n,i){n&1&&(Wt(0,`pch-card`,13),ws(1,`Nothing logged yet. Workouts members log show up here.`),Yt()),n&2&&Ch(`pchStagger`,3)}function ci(n,i){if(n&1&&(Wt(0,`a`,38),Ds(1,`pch-shaped-avatar`,39),ws(2),Wt(3,`span`,40),ws(4),Yt()()),n&2){let t=i.$implicit;Ch(`routerLink`,t.link),ke$1(),Ch(`shapeId`,t.peachId)(`name`,t.name),ke$1(),Uh(` `,t.name,` · `,t.day,` `),ke$1(2),Hh(t.summary)}}function mi(n,i){if(n&1&&(Wt(0,`pch-list-card`,14),BE(1,ci,5,6,`a`,38,Ce),Yt()),n&2){Es();let t=Ew(21);Ch(`pchStagger`,3),ke$1(),jE(t)}}function hi(n,i){n&1&&(Wt(0,`pch-card`,13),ws(1,`Every exercise members log shows up here, so you can log it too.`),Yt()),n&2&&Ch(`pchStagger`,4)}function ui(n,i){if(n&1&&(Wt(0,`pch-list-row`),ws(1),Wt(2,`span`,40),ws(3),Yt()()),n&2){let t=i.$implicit;ke$1(),go(` `,t.name,` `),ke$1(2),Hh(t.from)}}function pi(n,i){if(n&1){let t=cd();Wt(0,`button`,43),wr(`click`,function(){Ei(t);let a=Es(3);return wi(a.showAllExercises.set(!a.showAllExercises()))}),ws(1),Yt()}if(n&2){Es(2);let t=Ew(26),e=Es();ho(`aria-expanded`,e.showAllExercises()),ke$1(),go(` `,e.showAllExercises()?`Show fewer`:`Show all `+t.length,` `)}}function _i(n,i){if(n&1&&(Wt(0,`pch-list-card`,41),BE(1,ui,4,2,`pch-list-row`,null,Ce),Yt(),Gt(3,pi,2,2,`button`,42)),n&2){Es();let t=Ew(26),e=Es();Ch(`pchStagger`,4),ke$1(),jE(e.showAllExercises()?t:t.slice(0,e.exercisesShown)),ke$1(2),qt(t.length>e.exercisesShown?3:-1)}}function gi(n,i){if(n&1&&(Wt(0,`pch-list-row`),Ds(1,`pch-shaped-avatar`,44),ws(2),Wt(3,`span`,33),ws(4),Yt()()),n&2){let t=i.$implicit,e=Es(3),a=t.membership.role===`owner`;ke$1(),Ch(`shapeId`,t.peach.id)(`name`,t.peach.displayName)(`color`,a?`tertiary-container`:`secondary-container`)(`foreground`,a?`on-tertiary-container`:`on-secondary-container`),ke$1(),go(` `,t.peach.displayName,` `),ke$1(2),Hh(e.roleLabel(t.membership.role))}}function vi(n,i){if(n&1&&(Wt(0,`pch-list-card`,18),BE(1,gi,5,6,`pch-list-row`,null,Xe),Yt()),n&2){Es();let t=Ew(30);Ch(`pchStagger`,5),ke$1(),jE(t)}}function bi(n,i){n&1&&Ds(0,`pch-loading-indicator`,10),n&2&&Ch(`size`,40)}function fi(n,i){if(n&1){let t=cd();Wt(0,`button`,45),wr(`click`,function(){Ei(t);let a=Es(2),l=Ew(0);return wi(a.newSeason(l))}),Wt(1,`span`,7),ws(2,`emoji_events`),Yt(),ws(3,` Season `),Yt()}}function yi(n,i){if(n&1){let t=cd();Wt(0,`pch-page`,2),Gt(1,qe,3,0,`button`,4),Wt(2,`div`,5)(3,`a`,6)(4,`span`,7),ws(5,`how_to_vote`),Yt(),Wt(6,`span`),ws(7),Yt()(),Wt(8,`button`,8),wr(`click`,function(){Ei(t);let a=Es(),l=Ew(0);return wi(a.copyCode(l))}),Wt(9,`span`,7),ws(10,`key`),Yt(),Wt(11,`span`),ws(12),Yt()()(),Wt(13,`pch-two-pane`)(14,`div`,9),Gt(15,Ge,4,2),qh(16),Gt(17,Ye,1,1,`pch-loading-indicator`,10)(18,Ze,2,1,`pch-card`,11)(19,li,10,7),Ds(20,`pch-section`,12),qh(21),Gt(22,di,2,1,`pch-card`,13)(23,mi,3,1,`pch-list-card`,14),Yt(),Wt(24,`div`,15),Ds(25,`pch-section`,16),qh(26),Gt(27,hi,2,1,`pch-card`,13)(28,_i,4,2),Ds(29,`pch-section`,17),qh(30),Gt(31,vi,3,1,`pch-list-card`,18)(32,bi,1,1,`pch-loading-indicator`,10),Yt()(),Gt(33,fi,4,0,`button`,19),Yt()}if(n&2){let t=Es(),e=Ew(0);Ch(`title`,e.name)(`subtitle`,e.description||void 0)(`maxWidth`,1080),ke$1(),qt(t.canShare?1:-1),ke$1(2),Ch(`routerLink`,Mw(18,We,e.id)),ke$1(4),Hh(t.voteLine()),ke$1(5),go(`Code `,e.inviteCode),ke$1(3),qt(t.disputes().length>0?15:-1),ke$1();let a=Dw(t.season());ke$1(),qt(a===void 0?17:a===null?18:19),ke$1(4);let l=Dw(t.activity());ke$1(),qt(l.length===0?22:23),ke$1(3),Ch(`top`,8),ke$1();let c=Dw(t.exercises());ke$1(),qt(c.length===0?27:28),ke$1(3);let v=Dw(t.members.value());ke$1(),qt(v?31:32),ke$1(2),qt(t.canStartSeason()?33:-1)}}function xi(n){let{rounds:i,matchups:t,me:e,canManage:a,today:l}=n;return i.map(c=>{let v=e?t.find(x=>x.roundId===c.id&&O(x,e))??null:null,p=null;return a&&c.status===`scheduled`&&c.weekStart<=l?p=`open`:a&&c.status===`open`&&(p=`close`),{round:c,title:`Week ${c.index+1} \xB7 ${g$1.week(c.weekStart)}`,subtitle:v?x(v)?`Bye`:`You have a matchup`:null,matchupLink:v&&c.status!==`scheduled`?[`/matchups`,v.id]:null,action:p}})}var Si=6;var ke=class n{state=f(Rb);dialog=f(Mt);crateId=mg.required();fmt=g$1;me=this.state.peachId;canShare=typeof navigator<`u`&&`share`in navigator;busyRound=X(null);crate=this.state.query(()=>this.crateId(),(i,t)=>t.crates.getById(i));members=this.state.query(()=>this.crateId(),async(i,t)=>{let e=await t.crateService.activeMembers(i),a=new Map((await t.peaches.getByIds(e.map(c=>c.peachId))).map(c=>[c.id,c])),l={owner:0,admin:1,member:2};return e.filter(c=>a.has(c.peachId)).sort((c,v)=>l[c.role]-l[v.role]).map(c=>({membership:c,peach:a.get(c.peachId)}))});names=ve(()=>new Map((this.members.value()??[]).map(i=>[i.peach.id,i.peach.displayName])));canManage=ve(()=>{let i=this.members.value()?.find(t=>t.peach.id===this.me());return!!i&&f$1(i.membership)});seasons=this.state.watch(()=>this.crateId(),(i,t)=>t.seasons.watchForCrate(i));season=ve(()=>{let i=this.seasons.value();if(i!==void 0)return i.find(b)??i[0]??null});seasonData=this.state.query(()=>this.season()?.id,async(i,t)=>{let[e,a,l]=await Promise.all([t.seasons.roundsOf(i),t.seasons.matchupsOf(i),t.seasonService.standings(i)]);return{seasonId:i,rounds:e,matchups:a,standings:l}});data=ve(()=>{let i=this.seasonData.value();return i&&i.seasonId===this.season()?.id?i:void 0});ballots=this.state.query(()=>this.crateId(),(i,t)=>t.votingService.ballotsOf(i));voteLine=ve(()=>{let i=this.ballots.value()?.length,t=this.members.value()?.length;return i===void 0||t===void 0?`Rules`:`Rules \xB7 ${i} of ${t} voted`});awaiting=this.state.query(()=>{let i=this.me();return i?{crateId:this.crateId(),me:i}:void 0},({crateId:i,me:t},e)=>e.disputeService.awaitingVote(i,t,this.state.now()));disputes=ve(()=>{let i=this.names();return(this.awaiting.value()??[]).map(t=>({view:t,owner:i.get(t.dispute.peachId)??`A Peach`,openedBy:i.get(t.dispute.openedBy)??`A Peach`,link:[`/crates`,this.crateId(),`logs`,t.dispute.logId]}))});shared=this.state.query(()=>this.crateId(),(i,t)=>t.logs.exercisesSharedWith(i));exercisesShown=Si;showAllExercises=X(!1);exercises=ve(()=>{let i=this.names(),t=new Map;for(let e of this.shared.value()??[]){let a=t.get(e.exercise.id)??{name:e.exercise.name,from:new Set,last:0};a.from.add(e.peachId===this.me()?`you`:i.get(e.peachId)??`a Peach`),a.last=Math.max(a.last,e.lastLoggedAt.getTime()),t.set(e.exercise.id,a)}return[...t.entries()].sort(([,e],[,a])=>a.last-e.last).map(([e,a])=>({id:e,name:a.name,from:`From ${g$1.names([...a.from])}`}))});recentLogs=this.state.query(()=>this.crateId(),(i,t)=>t.logs.recentlySharedWith(i,8));activity=ve(()=>{let i=this.names(),t=this.state.units();return(this.recentLogs.value()??[]).map(e=>({id:e.id,peachId:e.peachId,name:e.peachId===this.me()?`You`:i.get(e.peachId)??`A Peach`,day:g$1.day(Mc(e.startedAt)),summary:e.entries.slice(0,2).map(a=>`${a.exerciseName} ${g$1.entryHeadline(a,t)}`).join(`, `),link:e.peachId===this.me()?[`/log`,e.id]:[`/crates`,this.crateId(),`logs`,e.id]}))});standingRows=ve(()=>{let i=this.data();if(!i)return;let t=this.names();return i.standings.map(e=>({peachId:e.peachId,name:t.get(e.peachId)??`Peach`,wins:e.wins,losses:e.losses,ties:e.ties,streak:d(e),onWinningStreak:f$2(e),form:e.form,pointsFor:e.pointsFor,pointsAgainst:e.pointsAgainst}))});rounds=ve(()=>{let i=this.data();if(i)return xi({rounds:i.rounds,matchups:i.matchups,me:this.me(),canManage:this.canManage(),today:this.state.today()})});canStartSeason=ve(()=>{let i=this.season();return this.canManage()&&i!==void 0&&(i===null||!b(i))});roundStatusColor(i){return i===`open`?`primary`:void 0}roleLabel(i){return i===`owner`?`Owner`:i===`admin`?`Admin`:`Member`}async runRound(i){this.busyRound()||(this.busyRound.set(i.round.id),await this.state.run(t=>i.action===`open`?t.seasonService.openRound(i.round.id):t.seasonService.closeRound(i.round.id)),this.busyRound.set(null))}async copyCode(i){try{await navigator.clipboard.writeText(i.inviteCode),this.state.toast(`Invite code ${i.inviteCode} copied`)}catch{this.state.toast(`Invite code ${i.inviteCode}`)}}async share(i){try{await navigator.share({title:i.name,text:`Join my Crate "${i.name}" on Peaches with invite code ${i.inviteCode}.`})}catch(t){t instanceof DOMException&&t.name===`AbortError`||await this.copyCode(i)}}newSeason(i){this.dialog.open(ht,{data:i,width:`440px`,maxWidth:`calc(100vw - 32px)`})}static ɵfac=function(t){return new(t||n)};static ɵcmp=ie({type:n,selectors:[[`pch-crate-detail-page`]],inputs:{crateId:[1,`crateId`]},decls:4,vars:2,consts:[[1,`page-loading`],[`title`,`Crate`,`showBack`,``,`backLink`,`/crates`],[`showBack`,``,`backLink`,`/crates`,3,`title`,`subtitle`,`maxWidth`],[`icon`,`search_off`,`title`,`Crate not found`],[`pageActions`,``,`matIconButton`,``,`type`,`button`,`aria-label`,`Share invite code`,`matTooltip`,`Share invite code`],[1,`chips`],[1,`chip`,`action`,3,`routerLink`],[`aria-hidden`,`true`,1,`material-symbols-rounded`],[`type`,`button`,`aria-description`,`Copies the invite code`,1,`chip`,`action`,3,`click`],[`primaryPane`,``],[1,`loading`,3,`size`],[`variant`,`outlined`,1,`no-season`],[`title`,`Recent workouts`],[`variant`,`outlined`,3,`pchStagger`],[1,`activity`,3,`pchStagger`],[`secondaryPane`,``],[`title`,`Exercises`,3,`top`],[`title`,`Peaches`],[1,`members`,3,`pchStagger`],[`pageFab`,``,`matFab`,``,`extended`,``,`type`,`button`],[`pageActions`,``,`matIconButton`,``,`type`,`button`,`aria-label`,`Share invite code`,`matTooltip`,`Share invite code`,3,`click`],[`title`,`Your vote needed`,3,`top`],[1,`disputes`,3,`pchStagger`],[1,`dispute-link`,3,`routerLink`],[3,`view`,`owner`,`openedBy`],[3,`title`],[`sectionTrailing`,``,3,`color`],[3,`pchStagger`,`rows`,`highlightPeachId`],[`title`,`Weeks`],[1,`weeks`,3,`pchStagger`],[3,`interactive`],[`rowLeading`,``,`aria-hidden`,`true`,1,`round-number`,`pch-title-medium`],[1,`stretched`,3,`routerLink`],[`rowSubtitle`,``],[`rowTrailing`,``,1,`trailing`],[`matButton`,`tonal`,`type`,`button`,3,`disabled`],[3,`color`],[`matButton`,`tonal`,`type`,`button`,3,`click`,`disabled`],[`pch-list-row`,``,3,`routerLink`],[`rowLeading`,``,3,`shapeId`,`name`],[`rowSubtitle`,``,1,`one-line`],[1,`exercises`,3,`pchStagger`],[`matButton`,``,`type`,`button`,1,`show-all`],[`matButton`,``,`type`,`button`,1,`show-all`,3,`click`],[`rowLeading`,``,3,`shapeId`,`name`,`color`,`foreground`],[`pageFab`,``,`matFab`,``,`extended`,``,`type`,`button`,3,`click`]],template:function(t,e){if(t&1&&(qh(0),Gt(1,He,1,0,`pch-loading-indicator`,0)(2,je,2,0,`pch-page`,1)(3,yi,34,20,`pch-page`,2)),t&2){let a=Dw(e.crate.value());ke$1(),qt(a===void 0?1:a===null?2:3)}},dependencies:[l$1,D,x$1,d$1,u,oe,db,h1,ES,dt$1,de,Jn,y,M$1,me,dt,mt,l],styles:[`.page-loading[_ngcontent-%COMP%]{display:flex;margin:30vh auto 0}.loading[_ngcontent-%COMP%]{display:flex;margin:24px auto}.chips[_ngcontent-%COMP%]{display:flex;flex-wrap:wrap;gap:8px}.chip[_ngcontent-%COMP%]{position:relative;display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 16px 0 8px;box-sizing:border-box;border:1px solid var(--%NS%mat-sys-outline-variant);border-radius:var(--%NS%pch-radius-small);background:none;color:var(--%NS%mat-sys-on-surface);text-decoration:none;font:var(--%NS%mat-sys-label-large);letter-spacing:var(--%NS%mat-sys-label-large-tracking)}.chip[_ngcontent-%COMP%]   .material-symbols-rounded[_ngcontent-%COMP%]{font-size:18px;color:var(--%NS%mat-sys-primary)}.chip.action[_ngcontent-%COMP%]{cursor:pointer}.chip.action[_ngcontent-%COMP%]:before{content:"";position:absolute;inset:-8px 0}.chip.action[_ngcontent-%COMP%]:after{content:"";position:absolute;inset:0;border-radius:inherit;background:var(--%NS%mat-sys-on-surface);opacity:0;transition:opacity .15s linear}.chip.action[_ngcontent-%COMP%]:hover:after{opacity:var(--%NS%mat-sys-hover-state-layer-opacity)}.chip.action[_ngcontent-%COMP%]:active:after{opacity:var(--%NS%mat-sys-pressed-state-layer-opacity)}.no-season[_ngcontent-%COMP%]{margin-top:24px}.round-number[_ngcontent-%COMP%]{display:grid;place-items:center;flex:none;width:40px;height:40px;border-radius:50%;background:var(--%NS%mat-sys-secondary-container);color:var(--%NS%mat-sys-on-secondary-container)}.round-number[data-status=open][_ngcontent-%COMP%]{background:var(--%NS%mat-sys-primary);color:var(--%NS%mat-sys-on-primary)}.round-number[data-status=closed][_ngcontent-%COMP%]{background:var(--%NS%mat-sys-surface-container-high);color:var(--%NS%mat-sys-on-surface-variant)}.stretched[_ngcontent-%COMP%]{color:inherit;text-decoration:none}.stretched[_ngcontent-%COMP%]:before{content:"";position:absolute;inset:0;z-index:1}.stretched[_ngcontent-%COMP%]:focus-visible{outline:none}.stretched[_ngcontent-%COMP%]:focus-visible:before{outline:3px solid var(--%NS%mat-sys-secondary);outline-offset:-3px;border-radius:var(--%NS%pch-radius-medium)}.trailing[_ngcontent-%COMP%]{position:relative;z-index:2;display:inline-flex}.muted[_ngcontent-%COMP%]{color:var(--%NS%mat-sys-on-surface-variant)}.one-line[_ngcontent-%COMP%]{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}pch-two-pane[_ngcontent-%COMP%]{padding-bottom:96px}.disputes[_ngcontent-%COMP%]{display:flex;flex-direction:column;gap:8px}.dispute-link[_ngcontent-%COMP%]{color:inherit;text-decoration:none;border-radius:var(--%NS%pch-radius-large)}.show-all[_ngcontent-%COMP%]{margin-top:8px}`]})};export{ke as CrateDetailPage};