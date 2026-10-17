import{D as Zr,H as q$1,S as T,X as l,Z as m,a as Ce,c as Gr,i as B,t as $r}from"./chunk-COdvbNJF.js";import{Bn as pe,Bt as UP,Cn as ie,Ct as Mb,Dn as jd,Et as NS,F as $e,G as C,It as Rn,J as Ce$1,Jn as su,Jt as X,Ln as mr,Lt as So,Pt as Rg,Qt as YC,Rt as Sr,St as M,Tn as iu,Ut as Ur,V as Ae,X as Co,Xn as ta,Z as Cr,Zt as Y$1,_n as fo,ct as G,fn as dS,gn as f,gt as JC,hn as eu,ir as x,ln as bE,lt as Ge,nn as Yt$1,nr as wr,or as xr,pt as Ir,qn as se,qt as Wt$1,rt as Eo,sn as _s,sr as xt,tr as wo,ur as ze,vn as g,wt as Mh,xn as ho,z as AS,zt as T$1}from"./main-A5I7CLZE.js";var u=class{viewContainerRef;injector;id;role=`dialog`;panelClass=``;hasBackdrop=!0;backdropClass=``;disableClose=!1;closePredicate;width=``;height=``;minWidth;minHeight;maxWidth;maxHeight;positionStrategy;data=null;direction;ariaDescribedBy=null;ariaLabelledBy=null;ariaLabel=null;ariaModal=!1;autoFocus=`first-tabbable`;restoreFocus=!0;scrollStrategy;closeOnNavigation=!0;closeOnDestroy=!0;closeOnOverlayDetachments=!0;disableAnimations=!1;providers;container;templateContext;bindings};var U=(()=>{class n extends Co{_elementRef=f(G);_focusTrapFactory=f(dS);_config;_interactivityChecker=f(JC);_ngZone=f(M);_focusMonitor=f(jd);_renderer=f(ze);_changeDetectorRef=f(xr);_injector=f(x);_platform=f(Y$1);_document=f(C);_portalOutlet;_focusTrapped=new T;_focusTrap=null;_elementFocusedBeforeDialogWasOpened=null;_closeInteractionType=null;_ariaLabelledByQueue=[];_isDestroyed=!1;constructor(){super(),this._config=f(u,{optional:!0})||new u,this._config.ariaLabelledBy&&this._ariaLabelledByQueue.push(this._config.ariaLabelledBy)}_addAriaLabelledBy(t){this._ariaLabelledByQueue.push(t),this._changeDetectorRef.markForCheck()}_removeAriaLabelledBy(t){let e=this._ariaLabelledByQueue.indexOf(t);e>-1&&(this._ariaLabelledByQueue.splice(e,1),this._changeDetectorRef.markForCheck())}_contentAttached(){this._initializeFocusTrap(),this._captureInitialFocus()}_captureInitialFocus(){this._trapFocus()}ngOnDestroy(){this._focusTrapped.complete(),this._isDestroyed=!0,this._restoreFocus()}attachComponentPortal(t){this._portalOutlet.hasAttached();let e=this._portalOutlet.attachComponentPortal(t);return this._contentAttached(),e}attachTemplatePortal(t){this._portalOutlet.hasAttached();let e=this._portalOutlet.attachTemplatePortal(t);return this._contentAttached(),e}attachDomPortal=t=>{this._portalOutlet.hasAttached();let e=this._portalOutlet.attachDomPortal(t);return this._contentAttached(),e};_recaptureFocus(){this._containsFocus()||this._trapFocus()}_forceFocus(t,e){this._interactivityChecker.isFocusable(t)||(t.tabIndex=-1,this._ngZone.runOutsideAngular(()=>{let i=()=>{a(),r(),t.removeAttribute(`tabindex`)},a=this._renderer.listen(t,`blur`,i),r=this._renderer.listen(t,`mousedown`,i)})),t.focus(e)}_focusByCssSelector(t,e){let i=this._elementRef.nativeElement.querySelector(t);i&&this._forceFocus(i,e)}_trapFocus(t){this._isDestroyed||Ge(()=>{let e=this._elementRef.nativeElement;switch(this._config.autoFocus){case!1:case`dialog`:this._containsFocus()||e.focus(t);break;case!0:case`first-tabbable`:this._focusTrap?.focusInitialElement(t)||this._focusDialogContainer(t);break;case`first-heading`:this._focusByCssSelector(`h1, h2, h3, h4, h5, h6, [role="heading"]`,t);break;default:this._focusByCssSelector(this._config.autoFocus,t)}this._focusTrapped.next()},{injector:this._injector})}_restoreFocus(){let t=this._config.restoreFocus,e=null;if(typeof t==`string`?e=this._document.querySelector(t):typeof t==`boolean`?e=t?this._elementFocusedBeforeDialogWasOpened:null:t&&(e=t),this._config.restoreFocus&&e&&typeof e.focus==`function`){let i=YC(),a=this._elementRef.nativeElement;(!i||i===this._document.body||i===a||a.contains(i))&&(this._focusMonitor?(this._focusMonitor.focusVia(e,this._closeInteractionType),this._closeInteractionType=null):e.focus())}this._focusTrap&&this._focusTrap.destroy()}_focusDialogContainer(t){this._elementRef.nativeElement.focus?.(t)}_containsFocus(){let t=this._elementRef.nativeElement,e=YC();return t===e||t.contains(e)}_initializeFocusTrap(){this._platform.isBrowser&&(this._focusTrap=this._focusTrapFactory.create(this._elementRef.nativeElement),this._document&&(this._elementFocusedBeforeDialogWasOpened=YC()))}static ɵfac=function(e){return new(e||n)};static ɵcmp=(function(){function t(e,i){}return ie({type:n,selectors:[[`cdk-dialog-container`]],viewQuery:function(i,a){if(i&1&&Cr(eu,7),i&2){let r;Sr(r=Ir())&&(a._portalOutlet=r.first)}},hostAttrs:[`tabindex`,`-1`,1,`cdk-dialog-container`],hostVars:6,hostBindings:function(i,a){i&2&&ho(`id`,a._config.id||null)(`role`,a._config.role)(`aria-modal`,a._config.ariaModal)(`aria-labelledby`,a._config.ariaLabel?null:a._ariaLabelledByQueue[0])(`aria-label`,a._config.ariaLabel)(`aria-describedby`,a._config.ariaDescribedBy||null)},features:[Ae],decls:1,vars:0,consts:[[`cdkPortalOutlet`,``]],template:function(i,a){i&1&&_s(0,t,0,0,`ng-template`,0)},dependencies:[eu],styles:[`.cdk-dialog-container {
  display: block;
  width: 100%;
  height: 100%;
  min-height: inherit;
  max-height: inherit;
}
`],encapsulation:2,changeDetection:1})})()}return n})();var p=class{overlayRef;config;componentInstance=null;componentRef=null;containerInstance;disableClose;closed=new T;backdropClick;keydownEvents;outsidePointerEvents;id;_detachSubscription;constructor(o,t){this.overlayRef=o,this.config=t,this.disableClose=t.disableClose,this.backdropClick=o.backdropClick(),this.keydownEvents=o.keydownEvents(),this.outsidePointerEvents=o.outsidePointerEvents(),this.id=t.id,this.keydownEvents.subscribe(e=>{e.keyCode===27&&!this.disableClose&&!UP(e)&&(e.preventDefault(),this.close(void 0,{focusOrigin:`keyboard`}))}),this.backdropClick.subscribe(()=>{!this.disableClose&&this._canClose()?this.close(void 0,{focusOrigin:`mouse`}):this.containerInstance._recaptureFocus?.()}),this._detachSubscription=o.detachments().subscribe(()=>{t.closeOnOverlayDetachments!==!1&&this.close()})}close(o,t){if(this._canClose(o)){let e=this.closed;this.containerInstance._closeInteractionType=t?.focusOrigin||`program`,this._detachSubscription.unsubscribe(),this.overlayRef.dispose(),e.next(o),e.complete(),this.componentInstance=this.containerInstance=null}}updatePosition(){return this.overlayRef.updatePosition(),this}updateSize(o=``,t=``){return this.overlayRef.updateSize({width:o,height:t}),this}addPanelClass(o){return this.overlayRef.addPanelClass(o),this}removePanelClass(o){return this.overlayRef.removePanelClass(o),this}_canClose(o){let t=this.config;return!!this.containerInstance&&(!t.closePredicate||t.closePredicate(o,t,this.componentInstance))}};var jt=new g(`DialogScrollStrategy`,{providedIn:`root`,factory:()=>{let n=f(x);return()=>AS(n)}});var zt=new g(`DialogData`);var Vt=new g(`DefaultDialogConfig`);function Ht(n){let o=X(n),t=new pe;return{valueSignal:o,get value(){return o()},change:t,ngOnDestroy(){t.complete()}}}var At=(()=>{class n{_injector=f(x);_defaultOptions=f(Vt,{optional:!0});_parentDialog=f(n,{optional:!0,skipSelf:!0});_overlayContainer=f(Mb);_idGenerator=f(Rn);_openDialogsAtThisLevel=[];_afterAllClosedAtThisLevel=new T;_afterOpenedAtThisLevel=new T;_ariaHiddenElements=new Map;_scrollStrategy=f(jt);get openDialogs(){return this._parentDialog?this._parentDialog.openDialogs:this._openDialogsAtThisLevel}get afterOpened(){return this._parentDialog?this._parentDialog.afterOpened:this._afterOpenedAtThisLevel}afterAllClosed=$r(()=>this.openDialogs.length?this._getAfterAllClosed():this._getAfterAllClosed().pipe(Zr(void 0)));open(t,e){let i=this._defaultOptions||new u;e=l(l({},i),e),e.id=e.id||this._idGenerator.getId(`cdk-dialog-`),e.id&&this.getDialogById(e.id);let a=this._getOverlayConfig(e),r=su(this._injector,a),l$1=new p(r,e),d=this._attachContainer(r,l$1,e);if(l$1.containerInstance=d,!this.openDialogs.length){let B=this._overlayContainer.getContainerElement();d._focusTrapped?d._focusTrapped.pipe(Ce(1)).subscribe(()=>{this._hideNonDialogContentFromAssistiveTechnology(B)}):this._hideNonDialogContentFromAssistiveTechnology(B)}return this._attachDialogContent(t,l$1,d,e),this.openDialogs.push(l$1),l$1.closed.subscribe(()=>this._removeOpenDialog(l$1,!0)),this.afterOpened.next(l$1),l$1}closeAll(){q(this.openDialogs,t=>t.close())}getDialogById(t){return this.openDialogs.find(e=>e.id===t)}ngOnDestroy(){q(this._openDialogsAtThisLevel,t=>{t.config.closeOnDestroy===!1&&this._removeOpenDialog(t,!1)}),q(this._openDialogsAtThisLevel,t=>t.close()),this._afterAllClosedAtThisLevel.complete(),this._afterOpenedAtThisLevel.complete(),this._openDialogsAtThisLevel=[]}_getOverlayConfig(t){let e=new So({positionStrategy:t.positionStrategy||iu().centerHorizontally().centerVertically(),scrollStrategy:t.scrollStrategy||this._scrollStrategy(),panelClass:t.panelClass,hasBackdrop:t.hasBackdrop,direction:t.direction,minWidth:t.minWidth,minHeight:t.minHeight,maxWidth:t.maxWidth,maxHeight:t.maxHeight,width:t.width,height:t.height,disposeOnNavigation:t.closeOnNavigation,disableAnimations:t.disableAnimations});return t.backdropClass&&(e.backdropClass=t.backdropClass),e}_attachContainer(t,e,i){let a=i.injector||i.viewContainerRef?.injector,r=[{provide:u,useValue:i},{provide:p,useValue:e},{provide:ta,useValue:t}],l;i.container?typeof i.container==`function`?l=i.container:(l=i.container.type,r.push(...i.container.providers(i))):l=U;let d=new Eo(l,i.viewContainerRef,x.create({parent:a||this._injector,providers:r}));return t.attach(d).instance}_attachDialogContent(t,e,i,a){if(t instanceof $e){let r=this._createInjector(a,e,i,void 0),l$2={$implicit:a.data,dialogRef:e};a.templateContext&&(l$2=l(l({},l$2),typeof a.templateContext==`function`?a.templateContext():a.templateContext)),i.attachTemplatePortal(new wo(t,null,l$2,r))}else{let r=this._createInjector(a,e,i,this._injector),l=i.attachComponentPortal(new Eo(t,a.viewContainerRef,r,null,a.bindings));e.componentRef=l,e.componentInstance=l.instance}}_createInjector(t,e,i,a){let r=t.injector||t.viewContainerRef?.injector,l=[{provide:zt,useValue:t.data},{provide:p,useValue:e}];return t.providers&&(typeof t.providers==`function`?l.push(...t.providers(e,t,i)):l.push(...t.providers)),t.direction&&(!r||!r.get(Ur,null,{optional:!0}))&&l.push({provide:Ur,useValue:Ht(t.direction)}),x.create({parent:r||a,providers:l})}_removeOpenDialog(t,e){let i=this.openDialogs.indexOf(t);i>-1&&(this.openDialogs.splice(i,1),this.openDialogs.length||(this._ariaHiddenElements.forEach((a,r)=>{a?r.setAttribute(`aria-hidden`,a):r.removeAttribute(`aria-hidden`)}),this._ariaHiddenElements.clear(),e&&this._getAfterAllClosed().next()))}_hideNonDialogContentFromAssistiveTechnology(t){if(t.parentElement){let e=t.parentElement.children;for(let i=e.length-1;i>-1;i--){let a=e[i];a!==t&&a.nodeName!==`SCRIPT`&&a.nodeName!==`STYLE`&&!a.hasAttribute(`aria-live`)&&!a.hasAttribute(`popover`)&&(this._ariaHiddenElements.set(a,a.getAttribute(`aria-hidden`)),a.setAttribute(`aria-hidden`,`true`))}}}_getAfterAllClosed(){let t=this._parentDialog;return t?t._getAfterAllClosed():this._afterAllClosedAtThisLevel}static ɵfac=function(e){return new(e||n)};static ɵprov=T$1({token:n,factory:n.ɵfac})}return n})();function q(n,o){let t=n.length;for(;t--;)o(n[t])}var R=class{viewContainerRef;injector;id;role=`dialog`;panelClass=``;hasBackdrop=!0;backdropClass=``;disableClose=!1;closePredicate;width=``;height=``;minWidth;minHeight;maxWidth;maxHeight;position;data=null;direction;ariaDescribedBy=null;ariaLabelledBy=null;ariaLabel=null;ariaModal=!1;autoFocus=`first-tabbable`;restoreFocus=!0;delayFocusTrap=!0;scrollStrategy;closeOnNavigation=!0;enterAnimationDuration;exitAnimationDuration;bindings};var Y=`mdc-dialog--open`;var wt=`mdc-dialog--opening`;var St=`mdc-dialog--closing`;var Gt=150;var Wt=75;var Qt=(()=>{class n extends U{_animationStateChanged=new pe;_animationsEnabled=!xt();_actionSectionCount=0;_hostElement=this._elementRef.nativeElement;_enterAnimationDuration=this._animationsEnabled?Ot(this._config.enterAnimationDuration)??Gt:0;_exitAnimationDuration=this._animationsEnabled?Ot(this._config.exitAnimationDuration)??Wt:0;_animationTimer=null;_contentAttached(){super._contentAttached(),this._startOpenAnimation()}_startOpenAnimation(){this._animationStateChanged.emit({state:`opening`,totalTime:this._enterAnimationDuration}),this._animationsEnabled?(this._hostElement.style.setProperty(kt,`${this._enterAnimationDuration}ms`),this._requestAnimationFrame(()=>this._hostElement.classList.add(wt,Y)),this._waitForAnimationToComplete(this._enterAnimationDuration,this._finishDialogOpen)):(this._hostElement.classList.add(Y),Promise.resolve().then(()=>this._finishDialogOpen()))}_startExitAnimation(){this._animationStateChanged.emit({state:`closing`,totalTime:this._exitAnimationDuration}),this._hostElement.classList.remove(Y),this._animationsEnabled?(this._hostElement.style.setProperty(kt,`${this._exitAnimationDuration}ms`),this._requestAnimationFrame(()=>this._hostElement.classList.add(St)),this._waitForAnimationToComplete(this._exitAnimationDuration,this._finishDialogClose)):Promise.resolve().then(()=>this._finishDialogClose())}_updateActionSectionCount(t){this._actionSectionCount+=t,this._changeDetectorRef.markForCheck()}_finishDialogOpen=()=>{this._clearAnimationClasses(),this._openAnimationDone(this._enterAnimationDuration)};_finishDialogClose=()=>{this._clearAnimationClasses(),this._animationStateChanged.emit({state:`closed`,totalTime:this._exitAnimationDuration})};_clearAnimationClasses(){this._hostElement.classList.remove(wt,St)}_waitForAnimationToComplete(t,e){this._animationTimer!==null&&clearTimeout(this._animationTimer),this._animationTimer=setTimeout(e,t)}_requestAnimationFrame(t){this._ngZone.runOutsideAngular(()=>{typeof requestAnimationFrame==`function`?requestAnimationFrame(t):t()})}_captureInitialFocus(){this._config.delayFocusTrap||this._trapFocus()}_openAnimationDone(t){this._config.delayFocusTrap&&this._trapFocus(),this._animationStateChanged.next({state:`opened`,totalTime:t})}ngOnDestroy(){super.ngOnDestroy(),this._animationTimer!==null&&clearTimeout(this._animationTimer)}attachComponentPortal(t){let e=super.attachComponentPortal(t);return e.location.nativeElement.classList.add(`mat-mdc-dialog-component-host`),e}static ɵfac=(()=>{let t;return function(i){return(t||(t=mr(n)))(i||n)}})();static ɵcmp=(function(){function t(e,i){}return ie({type:n,selectors:[[`mat-dialog-container`]],hostAttrs:[`tabindex`,`-1`,1,`mat-mdc-dialog-container`,`mdc-dialog`],hostVars:10,hostBindings:function(i,a){i&2&&(Mh(`id`,a._config.id),ho(`aria-modal`,a._config.ariaModal)(`role`,a._config.role)(`aria-labelledby`,a._config.ariaLabel?null:a._ariaLabelledByQueue[0])(`aria-label`,a._config.ariaLabel)(`aria-describedby`,a._config.ariaDescribedBy||null),Ce$1(`_mat-animation-noopable`,!a._animationsEnabled)(`mat-mdc-dialog-container-with-actions`,a._actionSectionCount>0))},features:[Ae],decls:3,vars:0,consts:[[1,`mat-mdc-dialog-inner-container`,`mdc-dialog__container`],[1,`mat-mdc-dialog-surface`,`mdc-dialog__surface`],[`cdkPortalOutlet`,``]],template:function(i,a){i&1&&(Wt$1(0,`div`,0)(1,`div`,1),_s(2,t,0,0,`ng-template`,2),Yt$1()())},dependencies:[eu],styles:[`.mat-mdc-dialog-container {
  width: 100%;
  height: 100%;
  display: block;
  box-sizing: border-box;
  max-height: inherit;
  min-height: inherit;
  min-width: inherit;
  max-width: inherit;
  outline: 0;
}

.cdk-overlay-pane.mat-mdc-dialog-panel {
  max-width: var(--%NS%mat-dialog-container-max-width, 560px);
  min-width: var(--%NS%mat-dialog-container-min-width, 280px);
}
@media (max-width: 599px) {
  .cdk-overlay-pane.mat-mdc-dialog-panel {
    max-width: var(--%NS%mat-dialog-container-small-max-width, calc(100vw - 32px));
  }
}

.mat-mdc-dialog-inner-container {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-around;
  box-sizing: border-box;
  height: 100%;
  opacity: 0;
  transition: opacity linear var(--%NS%mat-dialog-transition-duration, 0ms);
  max-height: inherit;
  min-height: inherit;
  min-width: inherit;
  max-width: inherit;
}
.mdc-dialog--closing .mat-mdc-dialog-inner-container {
  transition: opacity 75ms linear;
  transform: none;
}
.mdc-dialog--open .mat-mdc-dialog-inner-container {
  opacity: 1;
}
._mat-animation-noopable .mat-mdc-dialog-inner-container {
  transition: none;
}

.mat-mdc-dialog-surface {
  display: flex;
  flex-direction: column;
  flex-grow: 0;
  flex-shrink: 0;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  position: relative;
  overflow-y: auto;
  outline: 0;
  transform: scale(0.8);
  transition: transform var(--%NS%mat-dialog-transition-duration, 0ms) cubic-bezier(0, 0, 0.2, 1);
  max-height: inherit;
  min-height: inherit;
  min-width: inherit;
  max-width: inherit;
  box-shadow: var(--%NS%mat-dialog-container-elevation-shadow, none);
  border-radius: var(--%NS%mat-dialog-container-shape, var(--%NS%mat-sys-corner-extra-large, 4px));
  background-color: var(--%NS%mat-dialog-container-color, var(--%NS%mat-sys-surface, white));
}
[dir=rtl] .mat-mdc-dialog-surface {
  text-align: right;
}
.mdc-dialog--open .mat-mdc-dialog-surface, .mdc-dialog--closing .mat-mdc-dialog-surface {
  transform: none;
}
._mat-animation-noopable .mat-mdc-dialog-surface {
  transition: none;
}
.mat-mdc-dialog-surface::before {
  position: absolute;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  border: 2px solid transparent;
  border-radius: inherit;
  content: "";
  pointer-events: none;
}

.mat-mdc-dialog-title {
  display: block;
  position: relative;
  flex-shrink: 0;
  box-sizing: border-box;
  margin: 0 0 1px;
  padding: var(--%NS%mat-dialog-headline-padding, 6px 24px 13px);
}
.mat-mdc-dialog-title::before {
  display: inline-block;
  width: 0;
  height: 40px;
  content: "";
  vertical-align: 0;
}
[dir=rtl] .mat-mdc-dialog-title {
  text-align: right;
}
.mat-mdc-dialog-container .mat-mdc-dialog-title {
  color: var(--%NS%mat-dialog-subhead-color, var(--%NS%mat-sys-on-surface, rgba(0, 0, 0, 0.87)));
  font-family: var(--%NS%mat-dialog-subhead-font, var(--%NS%mat-sys-headline-small-font, inherit));
  line-height: var(--%NS%mat-dialog-subhead-line-height, var(--%NS%mat-sys-headline-small-line-height, 1.5rem));
  font-size: var(--%NS%mat-dialog-subhead-size, var(--%NS%mat-sys-headline-small-size, 1rem));
  font-weight: var(--%NS%mat-dialog-subhead-weight, var(--%NS%mat-sys-headline-small-weight, 400));
  letter-spacing: var(--%NS%mat-dialog-subhead-tracking, var(--%NS%mat-sys-headline-small-tracking, 0.03125em));
}

.mat-mdc-dialog-content {
  display: block;
  flex-grow: 1;
  box-sizing: border-box;
  margin: 0;
  overflow: auto;
  max-height: 65vh;
}
.mat-mdc-dialog-content > :first-child {
  margin-top: 0;
}
.mat-mdc-dialog-content > :last-child {
  margin-bottom: 0;
}
.mat-mdc-dialog-container .mat-mdc-dialog-content {
  color: var(--%NS%mat-dialog-supporting-text-color, var(--%NS%mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6)));
  font-family: var(--%NS%mat-dialog-supporting-text-font, var(--%NS%mat-sys-body-medium-font, inherit));
  line-height: var(--%NS%mat-dialog-supporting-text-line-height, var(--%NS%mat-sys-body-medium-line-height, 1.5rem));
  font-size: var(--%NS%mat-dialog-supporting-text-size, var(--%NS%mat-sys-body-medium-size, 1rem));
  font-weight: var(--%NS%mat-dialog-supporting-text-weight, var(--%NS%mat-sys-body-medium-weight, 400));
  letter-spacing: var(--%NS%mat-dialog-supporting-text-tracking, var(--%NS%mat-sys-body-medium-tracking, 0.03125em));
}
.mat-mdc-dialog-container .mat-mdc-dialog-content {
  padding: var(--%NS%mat-dialog-content-padding, 20px 24px);
}
.mat-mdc-dialog-container-with-actions .mat-mdc-dialog-content {
  padding: var(--%NS%mat-dialog-with-actions-content-padding, 20px 24px 0);
}
.mat-mdc-dialog-container .mat-mdc-dialog-title + .mat-mdc-dialog-content {
  padding-top: 0;
}

.mat-mdc-dialog-actions {
  display: flex;
  position: relative;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: center;
  box-sizing: border-box;
  min-height: 52px;
  margin: 0;
  border-top: 1px solid transparent;
  padding: var(--%NS%mat-dialog-actions-padding, 16px 24px);
  justify-content: var(--%NS%mat-dialog-actions-alignment, flex-end);
}
@media (forced-colors: active) {
  .mat-mdc-dialog-actions {
    border-top-color: CanvasText;
  }
}
.mat-mdc-dialog-actions.mat-mdc-dialog-actions-align-start, .mat-mdc-dialog-actions[align=start] {
  justify-content: start;
}
.mat-mdc-dialog-actions.mat-mdc-dialog-actions-align-center, .mat-mdc-dialog-actions[align=center] {
  justify-content: center;
}
.mat-mdc-dialog-actions.mat-mdc-dialog-actions-align-end, .mat-mdc-dialog-actions[align=end] {
  justify-content: flex-end;
}
.mat-mdc-dialog-actions .mat-button-base + .mat-button-base,
.mat-mdc-dialog-actions .mat-mdc-button-base + .mat-mdc-button-base {
  margin-left: 8px;
}
[dir=rtl] .mat-mdc-dialog-actions .mat-button-base + .mat-button-base,
[dir=rtl] .mat-mdc-dialog-actions .mat-mdc-button-base + .mat-mdc-button-base {
  margin-left: 0;
  margin-right: 8px;
}

.mat-mdc-dialog-component-host {
  display: contents;
}
`],encapsulation:2,changeDetection:1})})()}return n})();var kt=`--mat-dialog-transition-duration`;function Ot(n){return n==null?null:typeof n==`number`?n:n.endsWith(`ms`)?Rg(n.substring(0,n.length-2)):n.endsWith(`s`)?Rg(n.substring(0,n.length-1))*1e3:n===`0`?0:null}var P=(function(n){return n[n.OPEN=0]=`OPEN`,n[n.CLOSING=1]=`CLOSING`,n[n.CLOSED=2]=`CLOSED`,n})(P||{});var A=class{_ref;_config;_containerInstance;componentInstance;componentRef=null;disableClose;id;_afterOpened=new q$1(1);_beforeClosed=new q$1(1);_result;_closeFallbackTimeout;_state=P.OPEN;_closeInteractionType;constructor(o,t,e){this._ref=o,this._config=t,this._containerInstance=e,this.disableClose=t.disableClose,this.id=o.id,o.addPanelClass(`mat-mdc-dialog-panel`),e._animationStateChanged.pipe(B(i=>i.state===`opened`),Ce(1)).subscribe(()=>{this._afterOpened.next(),this._afterOpened.complete()}),e._animationStateChanged.pipe(B(i=>i.state===`closed`),Ce(1)).subscribe(()=>{clearTimeout(this._closeFallbackTimeout),this._finishDialogClose()}),o.overlayRef.detachments().subscribe(()=>{this._beforeClosed.next(this._result),this._beforeClosed.complete(),this._finishDialogClose()}),Gr(this.backdropClick(),this.keydownEvents().pipe(B(i=>i.keyCode===27&&!this.disableClose&&!UP(i)))).subscribe(i=>{this.disableClose||(i.preventDefault(),Tt(this,i.type===`keydown`?`keyboard`:`mouse`))})}close(o){let t=this._config.closePredicate;t&&!t(o,this._config,this.componentInstance)||(this._result=o,this._containerInstance._animationStateChanged.pipe(B(e=>e.state===`closing`),Ce(1)).subscribe(e=>{this._beforeClosed.next(o),this._beforeClosed.complete(),this._ref.overlayRef.detachBackdrop(),this._closeFallbackTimeout=setTimeout(()=>this._finishDialogClose(),e.totalTime+100)}),this._state=P.CLOSING,this._containerInstance._startExitAnimation())}afterOpened(){return this._afterOpened}afterClosed(){return this._ref.closed}beforeClosed(){return this._beforeClosed}backdropClick(){return this._ref.backdropClick}keydownEvents(){return this._ref.keydownEvents}updatePosition(o){let t=this._ref.config.positionStrategy;return o&&(o.left||o.right)?o.left?t.left(o.left):t.right(o.right):t.centerHorizontally(),o&&(o.top||o.bottom)?o.top?t.top(o.top):t.bottom(o.bottom):t.centerVertically(),this._ref.updatePosition(),this}updateSize(o=``,t=``){return this._ref.updateSize(o,t),this}addPanelClass(o){return this._ref.addPanelClass(o),this}removePanelClass(o){return this._ref.removePanelClass(o),this}getState(){return this._state}_finishDialogClose(){this._state=P.CLOSED,this._ref.close(this._result,{focusOrigin:this._closeInteractionType}),this.componentInstance=null}};function Tt(n,o,t){return n._closeInteractionType=o,n.close(t)}var qt=new g(`MatMdcDialogData`);var Ut=new g(`mat-mdc-dialog-default-options`);var Yt=new g(`mat-mdc-dialog-scroll-strategy`,{providedIn:`root`,factory:()=>{let n=f(x);return()=>AS(n)}});var Mt=(()=>{class n{_defaultOptions=f(Ut,{optional:!0});_scrollStrategy=f(Yt);_parentDialog=f(n,{optional:!0,skipSelf:!0});_idGenerator=f(Rn);_injector=f(x);_dialog=f(At);_animationsDisabled=xt();_openDialogsAtThisLevel=[];_afterAllClosedAtThisLevel=new T;_afterOpenedAtThisLevel=new T;dialogConfigClass=R;_dialogRefConstructor;_dialogContainerType;_dialogDataToken;get openDialogs(){return this._parentDialog?this._parentDialog.openDialogs:this._openDialogsAtThisLevel}get afterOpened(){return this._parentDialog?this._parentDialog.afterOpened:this._afterOpenedAtThisLevel}_getAfterAllClosed(){let t=this._parentDialog;return t?t._getAfterAllClosed():this._afterAllClosedAtThisLevel}afterAllClosed=$r(()=>this.openDialogs.length?this._getAfterAllClosed():this._getAfterAllClosed().pipe(Zr(void 0)));constructor(){this._dialogRefConstructor=A,this._dialogContainerType=Qt,this._dialogDataToken=qt}open(t,e){let i;e=l(l({},this._defaultOptions||new R),e),e.id=e.id||this._idGenerator.getId(`mat-mdc-dialog-`),e.scrollStrategy=e.scrollStrategy||this._scrollStrategy();let a=this._dialog.open(t,m(l({},e),{positionStrategy:iu(this._injector).centerHorizontally().centerVertically(),disableClose:!0,closePredicate:void 0,closeOnDestroy:!1,closeOnOverlayDetachments:!1,disableAnimations:this._animationsDisabled||e.enterAnimationDuration?.toLocaleString()===`0`||e.exitAnimationDuration?.toString()===`0`,container:{type:this._dialogContainerType,providers:()=>[{provide:this.dialogConfigClass,useValue:e},{provide:u,useValue:e}]},templateContext:()=>({dialogRef:i}),providers:(r,l,d)=>(i=new this._dialogRefConstructor(r,e,d),i.updatePosition(e?.position),[{provide:this._dialogContainerType,useValue:d},{provide:this._dialogDataToken,useValue:l.data},{provide:this._dialogRefConstructor,useValue:i},{provide:p,useValue:null}])}));return i.componentRef=a.componentRef,i.componentInstance=a.componentInstance,this.openDialogs.push(i),this.afterOpened.next(i),i.afterClosed().subscribe(()=>{let r=this.openDialogs.indexOf(i);r>-1&&(this.openDialogs.splice(r,1),this.openDialogs.length||this._getAfterAllClosed().next())}),i}closeAll(){this._closeDialogs(this.openDialogs)}getDialogById(t){return this.openDialogs.find(e=>e.id===t)}ngOnDestroy(){this._closeDialogs(this._openDialogsAtThisLevel),this._afterAllClosedAtThisLevel.complete(),this._afterOpenedAtThisLevel.complete()}_closeDialogs(t){let e=t.length;for(;e--;)t[e].close()}static ɵfac=function(e){return new(e||n)};static ɵprov=T$1({token:n,factory:n.ɵfac})}return n})();var Ne=(()=>{class n{dialogRef=f(A,{optional:!0});_elementRef=f(G);_dialog=f(Mt);ariaLabel;type=`button`;dialogResult;_matDialogClose;ngOnInit(){this.dialogRef||(this.dialogRef=Et(this._elementRef,this._dialog.openDialogs))}ngOnChanges(t){let e=t._matDialogClose;e&&(this.dialogResult=e.currentValue)}_onButtonClick(t){this._elementRef.nativeElement.getAttribute(`aria-disabled`)!==`true`&&Tt(this.dialogRef,t.screenX===0&&t.screenY===0?`keyboard`:`mouse`,this.dialogResult)}static ɵfac=function(e){return new(e||n)};static ɵdir=se({type:n,selectors:[[``,`mat-dialog-close`,``],[``,`matDialogClose`,``]],hostVars:2,hostBindings:function(e,i){e&1&&wr(`click`,function(r){return i._onButtonClick(r)}),e&2&&ho(`aria-label`,i.ariaLabel||null)(`type`,i.type)},inputs:{ariaLabel:[0,`aria-label`,`ariaLabel`],type:`type`,dialogResult:[0,`mat-dialog-close`,`dialogResult`],_matDialogClose:[0,`matDialogClose`,`_matDialogClose`]},exportAs:[`matDialogClose`],features:[fo]})}return n})();var It=(()=>{class n{_dialogRef=f(A,{optional:!0});_elementRef=f(G);_dialog=f(Mt);ngOnInit(){this._dialogRef||(this._dialogRef=Et(this._elementRef,this._dialog.openDialogs)),this._dialogRef&&Promise.resolve().then(()=>{this._onAdd()})}ngOnDestroy(){this._dialogRef?._containerInstance&&Promise.resolve().then(()=>{this._onRemove()})}static ɵfac=function(e){return new(e||n)};static ɵdir=se({type:n})}return n})();var Pe=(()=>{class n extends It{id=f(Rn).getId(`mat-mdc-dialog-title-`);_onAdd(){this._dialogRef._containerInstance?._addAriaLabelledBy?.(this.id)}_onRemove(){this._dialogRef?._containerInstance?._removeAriaLabelledBy?.(this.id)}static ɵfac=(()=>{let t;return function(i){return(t||(t=mr(n)))(i||n)}})();static ɵdir=se({type:n,selectors:[[``,`mat-dialog-title`,``],[``,`matDialogTitle`,``]],hostAttrs:[1,`mat-mdc-dialog-title`,`mdc-dialog__title`],hostVars:1,hostBindings:function(e,i){e&2&&Mh(`id`,i.id)},inputs:{id:`id`},exportAs:[`matDialogTitle`],features:[Ae]})}return n})();var Re=(()=>{class n{static ɵfac=function(e){return new(e||n)};static ɵdir=se({type:n,selectors:[[``,`mat-dialog-content`,``],[`mat-dialog-content`],[``,`matDialogContent`,``]],hostAttrs:[1,`mat-mdc-dialog-content`,`mdc-dialog__content`],features:[bE([NS])]})}return n})();var Be=(()=>{class n extends It{align;_onAdd(){this._dialogRef._containerInstance?._updateActionSectionCount?.(1)}_onRemove(){this._dialogRef._containerInstance?._updateActionSectionCount?.(-1)}static ɵfac=(()=>{let t;return function(i){return(t||(t=mr(n)))(i||n)}})();static ɵdir=se({type:n,selectors:[[``,`mat-dialog-actions`,``],[`mat-dialog-actions`],[``,`matDialogActions`,``]],hostAttrs:[1,`mat-mdc-dialog-actions`,`mdc-dialog__actions`],hostVars:6,hostBindings:function(e,i){e&2&&Ce$1(`mat-mdc-dialog-actions-align-start`,i.align===`start`)(`mat-mdc-dialog-actions-align-center`,i.align===`center`)(`mat-mdc-dialog-actions-align-end`,i.align===`end`)},inputs:{align:`align`},features:[Ae]})}return n})();function Et(n,o){let t=n.nativeElement.parentElement;for(;t&&!t.classList.contains(`mat-mdc-dialog-container`);)t=t.parentElement;return t?o.find(e=>e.id===t.id):null}export{Ne as a,U as c,Mt as i,qt as l,At as n,Pe as o,Be as r,Re as s,A as t};