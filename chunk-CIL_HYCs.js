import{S as T,X as l,Z as m,a as Ce,c as Gr,i as B}from"./chunk-COdvbNJF.js";import{Bn as pe,Bt as UP,Cn as ie,Gt as Vd,J as Ce$1,Tn as iu,V as Ae,Xt as Xg,gn as f,hn as eu,ir as x,nr as wr,sn as _s,sr as xt,vn as g,xn as ho,z as AS,zt as T$1}from"./main-A5I7CLZE.js";import{c as U,n as At}from"./chunk-pa1hN3Fb.js";var L=`_mat-bottom-sheet-enter`;var F=`_mat-bottom-sheet-exit`;var j=(()=>{class o extends U{_breakpointSubscription;_animationsDisabled=xt();_animationState=`void`;_animationStateChanged=new pe;_destroyed=!1;constructor(){super();let t=f(Vd);this._breakpointSubscription=t.observe([Xg.Medium,Xg.Large,Xg.XLarge]).subscribe(()=>{let a=this._elementRef.nativeElement.classList;a.toggle(`mat-bottom-sheet-container-medium`,t.isMatched(Xg.Medium)),a.toggle(`mat-bottom-sheet-container-large`,t.isMatched(Xg.Large)),a.toggle(`mat-bottom-sheet-container-xlarge`,t.isMatched(Xg.XLarge))})}enter(){this._destroyed||(this._animationState=`visible`,this._changeDetectorRef.markForCheck(),this._changeDetectorRef.detectChanges(),this._animationsDisabled&&this._simulateAnimation(L))}exit(){this._destroyed||(this._elementRef.nativeElement.setAttribute(`mat-exit`,``),this._animationState=`hidden`,this._changeDetectorRef.markForCheck(),this._animationsDisabled&&this._simulateAnimation(F))}ngOnDestroy(){super.ngOnDestroy(),this._breakpointSubscription.unsubscribe(),this._destroyed=!0}_simulateAnimation(t){this._ngZone.run(()=>{this._handleAnimationEvent(!0,t,this._elementRef.nativeElement),setTimeout(()=>this._handleAnimationEvent(!1,t,this._elementRef.nativeElement))})}_trapFocus(){super._trapFocus({preventScroll:!0})}_handleAnimationEvent(t,a,e){if(e===this._elementRef.nativeElement){let n=a===L;(n||a===F)&&this._animationStateChanged.emit({toState:n?`visible`:`hidden`,phase:t?`start`:`done`})}}static ɵfac=function(a){return new(a||o)};static ɵcmp=(function(){function t(a,e){}return ie({type:o,selectors:[[`mat-bottom-sheet-container`]],hostAttrs:[`tabindex`,`-1`,1,`mat-bottom-sheet-container`],hostVars:9,hostBindings:function(e,n){e&1&&wr(`animationstart`,function(i){return n._handleAnimationEvent(!0,i.animationName,i.target)})(`animationend`,function(i){return n._handleAnimationEvent(!1,i.animationName,i.target)})(`animationcancel`,function(i){return n._handleAnimationEvent(!1,i.animationName,i.target)}),e&2&&(ho(`role`,n._config.role)(`aria-modal`,n._config.ariaModal)(`aria-label`,n._config.ariaLabel),Ce$1(`mat-bottom-sheet-container-animations-enabled`,!n._animationsDisabled)(`mat-bottom-sheet-container-enter`,n._animationState===`visible`)(`mat-bottom-sheet-container-exit`,n._animationState===`hidden`))},features:[Ae],decls:1,vars:0,consts:[[`cdkPortalOutlet`,``]],template:function(e,n){e&1&&_s(0,t,0,0,`ng-template`,0)},dependencies:[eu],styles:[`@keyframes _mat-bottom-sheet-enter {
  from {
    transform: translateY(100%);
  }
  to {
    transform: none;
  }
}
@keyframes _mat-bottom-sheet-exit {
  from {
    transform: none;
  }
  to {
    transform: translateY(100%);
  }
}
.mat-bottom-sheet-container {
  box-shadow: 0px 8px 10px -5px rgba(0, 0, 0, 0.2), 0px 16px 24px 2px rgba(0, 0, 0, 0.14), 0px 6px 30px 5px rgba(0, 0, 0, 0.12);
  padding: 8px 16px;
  min-width: 100vw;
  box-sizing: border-box;
  display: block;
  outline: 0;
  max-height: 80vh;
  overflow: auto;
  position: relative;
  background: var(--%NS%mat-bottom-sheet-container-background-color, var(--%NS%mat-sys-surface-container-low));
  color: var(--%NS%mat-bottom-sheet-container-text-color, var(--%NS%mat-sys-on-surface));
  font-family: var(--%NS%mat-bottom-sheet-container-text-font, var(--%NS%mat-sys-body-large-font));
  font-size: var(--%NS%mat-bottom-sheet-container-text-size, var(--%NS%mat-sys-body-large-size));
  line-height: var(--%NS%mat-bottom-sheet-container-text-line-height, var(--%NS%mat-sys-body-large-line-height));
  font-weight: var(--%NS%mat-bottom-sheet-container-text-weight, var(--%NS%mat-sys-body-large-weight));
  letter-spacing: var(--%NS%mat-bottom-sheet-container-text-tracking, var(--%NS%mat-sys-body-large-tracking));
}
@media (forced-colors: active) {
  .mat-bottom-sheet-container {
    outline: 1px solid;
  }
}

.mat-bottom-sheet-container-animations-enabled {
  transform: translateY(100%);
}
.mat-bottom-sheet-container-animations-enabled.mat-bottom-sheet-container-enter {
  animation: _mat-bottom-sheet-enter 195ms cubic-bezier(0, 0, 0.2, 1) forwards;
}
.mat-bottom-sheet-container-animations-enabled.mat-bottom-sheet-container-exit {
  animation: _mat-bottom-sheet-exit 375ms cubic-bezier(0.4, 0, 1, 1) backwards;
}

.mat-bottom-sheet-container-xlarge, .mat-bottom-sheet-container-large, .mat-bottom-sheet-container-medium {
  border-top-left-radius: var(--%NS%mat-bottom-sheet-container-shape, 28px);
  border-top-right-radius: var(--%NS%mat-bottom-sheet-container-shape, 28px);
}

.mat-bottom-sheet-container-medium {
  min-width: 384px;
  max-width: calc(100vw - 128px);
}

.mat-bottom-sheet-container-large {
  min-width: 512px;
  max-width: calc(100vw - 256px);
}

.mat-bottom-sheet-container-xlarge {
  min-width: 576px;
  max-width: calc(100vw - 384px);
}
`],encapsulation:2,changeDetection:1})})()}return o})();var P=new g(`MatBottomSheetData`);var u=class{viewContainerRef;injector;panelClass;direction;data=null;hasBackdrop=!0;backdropClass;disableClose=!1;ariaLabel=null;ariaModal=!1;closeOnNavigation=!0;autoFocus=`first-tabbable`;restoreFocus=!0;scrollStrategy;height=``;minHeight;maxHeight;bindings};var b=class{_ref;get instance(){return this._ref.componentInstance}get componentRef(){return this._ref.componentRef}containerInstance;disableClose;_afterOpened=new T;_result;_closeFallbackTimeout;constructor(c,t,a){this._ref=c,this.containerInstance=a,this.disableClose=t.disableClose,a._animationStateChanged.pipe(B(e=>e.phase===`done`&&e.toState===`visible`),Ce(1)).subscribe(()=>{this._afterOpened.next(),this._afterOpened.complete()}),a._animationStateChanged.pipe(B(e=>e.phase===`done`&&e.toState===`hidden`),Ce(1)).subscribe(()=>{clearTimeout(this._closeFallbackTimeout),this._ref.close(this._result)}),c.overlayRef.detachments().subscribe(()=>{this._ref.close(this._result)}),Gr(this.backdropClick(),this.keydownEvents().pipe(B(e=>e.keyCode===27))).subscribe(e=>{!this.disableClose&&(e.type!==`keydown`||!UP(e))&&(e.preventDefault(),this.dismiss())})}dismiss(c){this.containerInstance&&(this.containerInstance._animationStateChanged.pipe(B(t=>t.phase===`start`),Ce(1)).subscribe(()=>{this._closeFallbackTimeout=setTimeout(()=>this._ref.close(this._result),500),this._ref.overlayRef.detachBackdrop()}),this._result=c,this.containerInstance.exit(),this.containerInstance=null)}afterDismissed(){return this._ref.closed}afterOpened(){return this._afterOpened}backdropClick(){return this._ref.backdropClick}keydownEvents(){return this._ref.keydownEvents}};var Y=new g(`mat-bottom-sheet-default-options`);var lt=(()=>{class o{_injector=f(x);_parentBottomSheet=f(o,{optional:!0,skipSelf:!0});_animationsDisabled=xt();_defaultOptions=f(Y,{optional:!0});_bottomSheetRefAtThisLevel=null;_dialog=f(At);get _openedBottomSheetRef(){let t=this._parentBottomSheet;return t?t._openedBottomSheetRef:this._bottomSheetRefAtThisLevel}set _openedBottomSheetRef(t){this._parentBottomSheet?this._parentBottomSheet._openedBottomSheetRef=t:this._bottomSheetRefAtThisLevel=t}open(t,a){let e=l(l({},this._defaultOptions||new u),a),n;return this._dialog.open(t,m(l({},e),{disableClose:!0,closeOnOverlayDetachments:!1,maxWidth:`100%`,container:j,scrollStrategy:e.scrollStrategy||AS(this._injector),positionStrategy:iu(this._injector).centerHorizontally().bottom(`0`),disableAnimations:this._animationsDisabled,templateContext:()=>({bottomSheetRef:n}),providers:(m,i,z)=>(n=new b(m,e,z),[{provide:b,useValue:n},{provide:P,useValue:e.data}])})),n.afterDismissed().subscribe(()=>{this._openedBottomSheetRef===n&&(this._openedBottomSheetRef=null)}),this._openedBottomSheetRef?(this._openedBottomSheetRef.afterDismissed().subscribe(()=>n.containerInstance?.enter()),this._openedBottomSheetRef.dismiss()):n.containerInstance.enter(),this._openedBottomSheetRef=n,n}dismiss(t){this._openedBottomSheetRef&&this._openedBottomSheetRef.dismiss(t)}ngOnDestroy(){this._bottomSheetRefAtThisLevel&&this._bottomSheetRefAtThisLevel.dismiss()}static ɵfac=function(a){return new(a||o)};static ɵprov=T$1({token:o,factory:o.ɵfac})}return o})();export{b as n,lt as r,P as t};