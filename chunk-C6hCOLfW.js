import"./chunk-COdvbNJF.js";import{A as j,B as s}from"./chunk-BWPwA6Qd.js";import{$ as Ds,$n as ve,At as Oe,Ct as M,Dn as jE,Fn as mf,G as BE,Gn as qt,Hn as pf,Ht as Uh,In as mg,Jt as Wt,Lt as Rn,Nt as Rb,Pt as Re,Q as Cr,Sn as ho,St as LL,Tn as ig,Tt as Mh,Vn as pe,X as Ch,Y as Ce,Yt as X,_n as f,at as Es,b,bt as Kh,cr as xt,dn as be,dt as Gt,er as wh,fn as cd,ft as Hh,hn as dd,in as ZE,ir as ws,jn as ke,kn as jo,lt as G,mn as db,mt as Ir,nt as Ed,or as xn,qn as sb,rn as Yt,rr as wr,rt as Ei,sr as xr,t as Ee,tr as wi,tt as ES,v as P,vn as fo,wn as ie,yn as g,z as $t,zt as Sr}from"./main-TWRLWM3V.js";import{n as J,t as Be$1}from"./chunk-DS1wZatK.js";import{f as me,p as oe,s as de,u as g$1}from"./chunk-nHxGnYq5.js";import{t as l}from"./chunk-O_BecoQU.js";import{t as d}from"./chunk-0ceDvrKr.js";import{t as x}from"./chunk-6YxqkNhC.js";var ze=(()=>{class a{labelPosition=`after`;static ɵfac=function(t){return new(t||a)};static ɵcmp=(function(){return ie({type:a,selectors:[[``,`mat-internal-form-field`,``]],hostAttrs:[1,`mdc-form-field`,`mat-internal-form-field`],hostVars:2,hostBindings:function(o,i){o&2&&Ce(`mdc-form-field--align-end`,i.labelPosition===`before`)},inputs:{labelPosition:`labelPosition`},ngContentSelectors:[`*`],decls:1,vars:0,template:function(o,i){o&1&&(xn(),be(0))},styles:[`.mat-internal-form-field {
  -moz-osx-font-smoothing: grayscale;
  -webkit-font-smoothing: antialiased;
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}
.mat-internal-form-field > label, .mat-internal-form-field > .mat-internal-form-field-label {
  margin-left: 0;
  margin-right: auto;
  padding-left: 4px;
  padding-right: 0;
  order: 0;
}
[dir=rtl] .mat-internal-form-field > label, [dir=rtl] .mat-internal-form-field > .mat-internal-form-field-label {
  margin-left: auto;
  margin-right: 0;
  padding-left: 0;
  padding-right: 4px;
}

.mdc-form-field--align-end > label, .mdc-form-field--align-end > .mat-internal-form-field-label {
  margin-left: auto;
  margin-right: 0;
  padding-left: 0;
  padding-right: 4px;
  order: -1;
}
[dir=rtl] .mdc-form-field--align-end .mdc-form-field--align-end label, [dir=rtl] .mdc-form-field--align-end .mdc-form-field--align-end .mat-internal-form-field-label {
  margin-left: 0;
  margin-right: auto;
  padding-left: 4px;
  padding-right: 0;
}
`],encapsulation:2})})()}return a})();var B={color:`accent`,clickAction:`check-indeterminate`,disabledInteractive:!1};var Be=new g(`mat-checkbox-default-options`,{providedIn:`root`,factory:()=>B});var k=(function(a){return a[a.Init=0]=`Init`,a[a.Checked=1]=`Checked`,a[a.Unchecked=2]=`Unchecked`,a[a.Indeterminate=3]=`Indeterminate`,a})(k||{});var V=class{source;checked};var Te=(()=>{class a{_elementRef=f(G);_changeDetectorRef=f(xr);_ngZone=f(M);_animationsDisabled=xt();_options=f(Be,{optional:!0});focus(){this._inputElement.nativeElement.focus()}_createChangeEvent(e){let t=new V;return t.source=this,t.checked=e,t}_getAnimationTargetElement(){return this._inputElement?.nativeElement}_animationClasses={uncheckedToChecked:`mdc-checkbox--anim-unchecked-checked`,uncheckedToIndeterminate:`mdc-checkbox--anim-unchecked-indeterminate`,checkedToUnchecked:`mdc-checkbox--anim-checked-unchecked`,checkedToIndeterminate:`mdc-checkbox--anim-checked-indeterminate`,indeterminateToChecked:`mdc-checkbox--anim-indeterminate-checked`,indeterminateToUnchecked:`mdc-checkbox--anim-indeterminate-unchecked`};ariaLabel=``;ariaLabelledby=null;ariaDescribedby;ariaExpanded;ariaControls;ariaOwns;_uniqueId;id;get inputId(){return`${this.id||this._uniqueId}-input`}required=!1;labelPosition=`after`;name=null;change=new pe;indeterminateChange=new pe;value;disableRipple=!1;_inputElement;tabIndex;color;disabledInteractive;_onTouched=()=>{};_currentAnimationClass=``;_currentCheckState=k.Init;_controlValueAccessorChangeFn=()=>{};_validatorChangeFn=()=>{};constructor(){f(Oe).load(sb);let e=f(new ig(`tabindex`),{optional:!0});this._options=this._options||B,this.color=this._options.color||B.color,this.tabIndex=e==null?0:parseInt(e)||0,this.id=this._uniqueId=f(Rn).getId(`mat-mdc-checkbox-`),this.disabledInteractive=this._options?.disabledInteractive??!1}ngOnChanges(e){e.required&&this._validatorChangeFn()}ngAfterViewInit(){this._syncIndeterminate(this.indeterminate)}get checked(){return this._checked}set checked(e){e!=this.checked&&(this._checked=e,this._changeDetectorRef.markForCheck())}_checked=!1;get disabled(){return this._disabled}set disabled(e){e!==this.disabled&&(this._disabled=e,this._changeDetectorRef.markForCheck())}_disabled=!1;get indeterminate(){return this._indeterminate()}set indeterminate(e){let t=e!=this._indeterminate();this._indeterminate.set(e),t&&(e?this._transitionCheckState(k.Indeterminate):this._transitionCheckState(this.checked?k.Checked:k.Unchecked),this.indeterminateChange.emit(e)),this._syncIndeterminate(e)}_indeterminate=X(!1);_isRippleDisabled(){return this.disableRipple||this.disabled}_onLabelTextChange(){this._changeDetectorRef.detectChanges()}writeValue(e){this.checked=!!e}registerOnChange(e){this._controlValueAccessorChangeFn=e}registerOnTouched(e){this._onTouched=e}setDisabledState(e){this.disabled=e}validate(e){return this.required&&e.value!==!0?{required:!0}:null}registerOnValidatorChange(e){this._validatorChangeFn=e}_transitionCheckState(e){let t=this._currentCheckState,o=this._getAnimationTargetElement();if(!(t===e||!o)&&(this._currentAnimationClass&&o.classList.remove(this._currentAnimationClass),this._currentAnimationClass=this._getAnimationClassForCheckStateTransition(t,e),this._currentCheckState=e,this._currentAnimationClass.length>0)){o.classList.add(this._currentAnimationClass);let i=this._currentAnimationClass;this._ngZone.runOutsideAngular(()=>{setTimeout(()=>{o.classList.remove(i)},1e3)})}}_emitChangeEvent(){this._controlValueAccessorChangeFn(this.checked),this.change.emit(this._createChangeEvent(this.checked)),this._inputElement&&(this._inputElement.nativeElement.checked=this.checked)}toggle(){this.checked=!this.checked,this._controlValueAccessorChangeFn(this.checked)}_handleInputClick(){let e=this._options?.clickAction;!this.disabled&&e!==`noop`?(this.indeterminate&&e!==`check`&&Promise.resolve().then(()=>{this._indeterminate.set(!1),this.indeterminateChange.emit(!1)}),this._checked=!this._checked,this._transitionCheckState(this._checked?k.Checked:k.Unchecked),this._emitChangeEvent()):(this.disabled&&this.disabledInteractive||!this.disabled&&e===`noop`)&&(this._inputElement.nativeElement.checked=this.checked,this._inputElement.nativeElement.indeterminate=this.indeterminate)}_onInteractionEvent(e){e.stopPropagation()}_onBlur(){Promise.resolve().then(()=>{this._onTouched(),this._changeDetectorRef.markForCheck()})}_getAnimationClassForCheckStateTransition(e,t){if(this._animationsDisabled)return``;switch(e){case k.Init:if(t===k.Checked)return this._animationClasses.uncheckedToChecked;if(t==k.Indeterminate)return this._checked?this._animationClasses.checkedToIndeterminate:this._animationClasses.uncheckedToIndeterminate;break;case k.Unchecked:return t===k.Checked?this._animationClasses.uncheckedToChecked:this._animationClasses.uncheckedToIndeterminate;case k.Checked:return t===k.Unchecked?this._animationClasses.checkedToUnchecked:this._animationClasses.checkedToIndeterminate;case k.Indeterminate:return t===k.Checked?this._animationClasses.indeterminateToChecked:this._animationClasses.indeterminateToUnchecked}return``}_syncIndeterminate(e){let t=this._inputElement;t&&(t.nativeElement.indeterminate=e)}_onInputClick(){this._handleInputClick()}_preventBubblingFromLabel(e){e.target&&this._inputElement&&e.target!==this._inputElement.nativeElement&&e.stopPropagation()}static ɵfac=function(t){return new(t||a)};static ɵcmp=(function(){let e=[`input`];return ie({type:a,selectors:[[`mat-checkbox`]],viewQuery:function(i,c){if(i&1&&Cr(e,5),i&2){let l;Sr(l=Ir())&&(c._inputElement=l.first)}},hostAttrs:[1,`mat-mdc-checkbox`],hostVars:16,hostBindings:function(i,c){i&2&&(Mh(`id`,c.id),ho(`tabindex`,null)(`aria-label`,null)(`aria-labelledby`,null),dd(c.color?`mat-`+c.color:`mat-accent`),Ce(`_mat-animation-noopable`,c._animationsDisabled)(`mdc-checkbox--disabled`,c.disabled)(`mat-mdc-checkbox-disabled`,c.disabled)(`mat-mdc-checkbox-checked`,c.checked)(`mat-mdc-checkbox-disabled-interactive`,c.disabledInteractive))},inputs:{ariaLabel:[0,`aria-label`,`ariaLabel`],ariaLabelledby:[0,`aria-labelledby`,`ariaLabelledby`],ariaDescribedby:[0,`aria-describedby`,`ariaDescribedby`],ariaExpanded:[2,`aria-expanded`,`ariaExpanded`,Re],ariaControls:[0,`aria-controls`,`ariaControls`],ariaOwns:[0,`aria-owns`,`ariaOwns`],id:`id`,required:[2,`required`,`required`,Re],labelPosition:`labelPosition`,name:`name`,value:`value`,disableRipple:[2,`disableRipple`,`disableRipple`,Re],tabIndex:[2,`tabIndex`,`tabIndex`,o=>o==null?void 0:Ed(o)],color:`color`,disabledInteractive:[2,`disabledInteractive`,`disabledInteractive`,Re],checked:[2,`checked`,`checked`,Re],disabled:[2,`disabled`,`disabled`,Re],indeterminate:[2,`indeterminate`,`indeterminate`,Re]},outputs:{change:`change`,indeterminateChange:`indeterminateChange`},exportAs:[`matCheckbox`],features:[Kh([{provide:Be$1,useExisting:jo(()=>a),multi:!0},{provide:J,useExisting:a,multi:!0}]),fo],ngContentSelectors:[`*`],decls:15,vars:23,consts:[[`checkbox`,``],[`input`,``],[`label`,``],[`mat-internal-form-field`,``,3,`click`,`labelPosition`,`for`],[1,`mdc-checkbox`],[`aria-hidden`,`true`,1,`mat-mdc-checkbox-touch-target`],[`type`,`checkbox`,1,`mdc-checkbox__native-control`,3,`blur`,`click`,`change`,`checked`,`indeterminate`,`disabled`,`id`,`required`,`tabIndex`],[`aria-hidden`,`true`,1,`mdc-checkbox__ripple`],[`aria-hidden`,`true`,1,`mdc-checkbox__background`],[`focusable`,`false`,`viewBox`,`0 0 24 24`,1,`mdc-checkbox__checkmark`],[`fill`,`none`,`d`,`M1.73,12.91 8.1,19.28 22.79,4.59`,1,`mdc-checkbox__checkmark-path`],[1,`mdc-checkbox__mixedmark`],[`mat-ripple`,``,`aria-hidden`,`true`,1,`mat-mdc-checkbox-ripple`,`mat-focus-indicator`,3,`matRippleTrigger`,`matRippleDisabled`,`matRippleCentered`],[1,`mat-internal-form-field-label`,`mdc-label`]],template:function(i,c){if(i&1&&(xn(),Wt(0,`label`,3),wr(`click`,function(u){return c._preventBubblingFromLabel(u)}),Wt(1,`span`,4,0),Ds(3,`span`,5),Wt(4,`input`,6,1),wr(`blur`,function(){return c._onBlur()})(`click`,function(){return c._onInputClick()})(`change`,function(u){return c._onInteractionEvent(u)}),Yt(),Ds(6,`span`,7),Wt(7,`span`,8),pf(),Wt(8,`svg`,9),Ds(9,`path`,10),Yt(),mf(),Ds(10,`span`,11),Yt(),Ds(11,`span`,12),Yt(),Wt(12,`span`,13,2),be(14),Yt()()),i&2){let l=ZE(2);Ch(`labelPosition`,c.labelPosition)(`for`,c.inputId),ke(4),Ce(`mdc-checkbox--selected`,c.checked),Ch(`checked`,c.checked)(`indeterminate`,c.indeterminate)(`disabled`,c.disabled&&!c.disabledInteractive)(`id`,c.inputId)(`required`,c.required)(`tabIndex`,c.disabled&&!c.disabledInteractive?-1:c.tabIndex),ho(`aria-label`,c.ariaLabel||null)(`aria-labelledby`,c.ariaLabelledby)(`aria-describedby`,c.ariaDescribedby)(`aria-checked`,c.indeterminate?`mixed`:null)(`aria-controls`,c.ariaControls)(`aria-disabled`,c.disabled&&c.disabledInteractive?!0:null)(`aria-expanded`,c.ariaExpanded)(`aria-owns`,c.ariaOwns)(`name`,c.name)(`value`,c.value),ke(7),Ch(`matRippleTrigger`,l)(`matRippleDisabled`,c.disableRipple||c.disabled)(`matRippleCentered`,!0)}},dependencies:[LL,ze],styles:[`.mdc-checkbox {
  display: inline-block;
  position: relative;
  flex: 0 0 18px;
  box-sizing: content-box;
  width: 18px;
  height: 18px;
  line-height: 0;
  white-space: nowrap;
  cursor: pointer;
  vertical-align: bottom;
  padding: calc((var(--%NS%mat-checkbox-state-layer-size, 40px) - 18px) / 2);
  margin: calc((var(--%NS%mat-checkbox-state-layer-size, 40px) - var(--%NS%mat-checkbox-state-layer-size, 40px)) / 2);
}
.mdc-checkbox:hover > .mdc-checkbox__ripple {
  opacity: var(--%NS%mat-checkbox-unselected-hover-state-layer-opacity, var(--%NS%mat-sys-hover-state-layer-opacity));
  background-color: var(--%NS%mat-checkbox-unselected-hover-state-layer-color, var(--%NS%mat-sys-on-surface));
}
.mdc-checkbox:hover > .mat-mdc-checkbox-ripple > .mat-ripple-element {
  background-color: var(--%NS%mat-checkbox-unselected-hover-state-layer-color, var(--%NS%mat-sys-on-surface));
}
.mdc-checkbox .mdc-checkbox__native-control:focus + .mdc-checkbox__ripple {
  opacity: var(--%NS%mat-checkbox-unselected-focus-state-layer-opacity, var(--%NS%mat-sys-focus-state-layer-opacity));
  background-color: var(--%NS%mat-checkbox-unselected-focus-state-layer-color, var(--%NS%mat-sys-on-surface));
}
.mdc-checkbox .mdc-checkbox__native-control:focus ~ .mat-mdc-checkbox-ripple .mat-ripple-element {
  background-color: var(--%NS%mat-checkbox-unselected-focus-state-layer-color, var(--%NS%mat-sys-on-surface));
}
.mdc-checkbox:active > .mdc-checkbox__native-control + .mdc-checkbox__ripple {
  opacity: var(--%NS%mat-checkbox-unselected-pressed-state-layer-opacity, var(--%NS%mat-sys-pressed-state-layer-opacity));
  background-color: var(--%NS%mat-checkbox-unselected-pressed-state-layer-color, var(--%NS%mat-sys-primary));
}
.mdc-checkbox:active > .mdc-checkbox__native-control ~ .mat-mdc-checkbox-ripple .mat-ripple-element {
  background-color: var(--%NS%mat-checkbox-unselected-pressed-state-layer-color, var(--%NS%mat-sys-primary));
}
.mdc-checkbox:hover > .mdc-checkbox__native-control:checked + .mdc-checkbox__ripple {
  opacity: var(--%NS%mat-checkbox-selected-hover-state-layer-opacity, var(--%NS%mat-sys-hover-state-layer-opacity));
  background-color: var(--%NS%mat-checkbox-selected-hover-state-layer-color, var(--%NS%mat-sys-primary));
}
.mdc-checkbox:hover > .mdc-checkbox__native-control:checked ~ .mat-mdc-checkbox-ripple .mat-ripple-element {
  background-color: var(--%NS%mat-checkbox-selected-hover-state-layer-color, var(--%NS%mat-sys-primary));
}
.mdc-checkbox .mdc-checkbox__native-control:focus:checked + .mdc-checkbox__ripple {
  opacity: var(--%NS%mat-checkbox-selected-focus-state-layer-opacity, var(--%NS%mat-sys-focus-state-layer-opacity));
  background-color: var(--%NS%mat-checkbox-selected-focus-state-layer-color, var(--%NS%mat-sys-primary));
}
.mdc-checkbox .mdc-checkbox__native-control:focus:checked ~ .mat-mdc-checkbox-ripple .mat-ripple-element {
  background-color: var(--%NS%mat-checkbox-selected-focus-state-layer-color, var(--%NS%mat-sys-primary));
}
.mdc-checkbox:active > .mdc-checkbox__native-control:checked + .mdc-checkbox__ripple {
  opacity: var(--%NS%mat-checkbox-selected-pressed-state-layer-opacity, var(--%NS%mat-sys-pressed-state-layer-opacity));
  background-color: var(--%NS%mat-checkbox-selected-pressed-state-layer-color, var(--%NS%mat-sys-on-surface));
}
.mdc-checkbox:active > .mdc-checkbox__native-control:checked ~ .mat-mdc-checkbox-ripple .mat-ripple-element {
  background-color: var(--%NS%mat-checkbox-selected-pressed-state-layer-color, var(--%NS%mat-sys-on-surface));
}
.mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox .mdc-checkbox__native-control ~ .mat-mdc-checkbox-ripple .mat-ripple-element,
.mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox .mdc-checkbox__native-control + .mdc-checkbox__ripple {
  background-color: var(--%NS%mat-checkbox-unselected-hover-state-layer-color, var(--%NS%mat-sys-on-surface));
}
.mdc-checkbox .mdc-checkbox__native-control {
  position: absolute;
  margin: 0;
  padding: 0;
  opacity: 0;
  cursor: inherit;
  z-index: 1;
  width: var(--%NS%mat-checkbox-state-layer-size, 40px);
  height: var(--%NS%mat-checkbox-state-layer-size, 40px);
  top: calc((var(--%NS%mat-checkbox-state-layer-size, 40px) - var(--%NS%mat-checkbox-state-layer-size, 40px)) / 2);
  right: calc((var(--%NS%mat-checkbox-state-layer-size, 40px) - var(--%NS%mat-checkbox-state-layer-size, 40px)) / 2);
  left: calc((var(--%NS%mat-checkbox-state-layer-size, 40px) - var(--%NS%mat-checkbox-state-layer-size, 40px)) / 2);
}

.mdc-checkbox--disabled {
  cursor: default;
  pointer-events: none;
}

.mdc-checkbox__background {
  display: inline-flex;
  position: absolute;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 18px;
  height: 18px;
  border: 2px solid currentColor;
  border-radius: 2px;
  background-color: transparent;
  pointer-events: none;
  will-change: background-color, border-color;
  transition: background-color 90ms cubic-bezier(0.4, 0, 0.6, 1), border-color 90ms cubic-bezier(0.4, 0, 0.6, 1);
  -webkit-print-color-adjust: exact;
  color-adjust: exact;
  border-color: var(--%NS%mat-checkbox-unselected-icon-color, var(--%NS%mat-sys-on-surface-variant));
  top: calc((var(--%NS%mat-checkbox-state-layer-size, 40px) - 18px) / 2);
  left: calc((var(--%NS%mat-checkbox-state-layer-size, 40px) - 18px) / 2);
}

.mdc-checkbox__native-control:enabled:checked ~ .mdc-checkbox__background,
.mdc-checkbox__native-control:enabled:indeterminate ~ .mdc-checkbox__background {
  border-color: var(--%NS%mat-checkbox-selected-icon-color, var(--%NS%mat-sys-primary));
  background-color: var(--%NS%mat-checkbox-selected-icon-color, var(--%NS%mat-sys-primary));
}

.mdc-checkbox--disabled .mdc-checkbox__background {
  border-color: var(--%NS%mat-checkbox-disabled-unselected-icon-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));
}
@media (forced-colors: active) {
  .mdc-checkbox--disabled .mdc-checkbox__background {
    border-color: GrayText;
  }
}

.mdc-checkbox__native-control:disabled:checked ~ .mdc-checkbox__background,
.mdc-checkbox__native-control:disabled:indeterminate ~ .mdc-checkbox__background {
  background-color: var(--%NS%mat-checkbox-disabled-selected-icon-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));
  border-color: transparent;
}
@media (forced-colors: active) {
  .mdc-checkbox__native-control:disabled:checked ~ .mdc-checkbox__background,
  .mdc-checkbox__native-control:disabled:indeterminate ~ .mdc-checkbox__background {
    border-color: GrayText;
  }
}

.mdc-checkbox:hover > .mdc-checkbox__native-control:not(:checked) ~ .mdc-checkbox__background,
.mdc-checkbox:hover > .mdc-checkbox__native-control:not(:indeterminate) ~ .mdc-checkbox__background {
  border-color: var(--%NS%mat-checkbox-unselected-hover-icon-color, var(--%NS%mat-sys-on-surface));
  background-color: transparent;
}

.mdc-checkbox:hover > .mdc-checkbox__native-control:checked ~ .mdc-checkbox__background,
.mdc-checkbox:hover > .mdc-checkbox__native-control:indeterminate ~ .mdc-checkbox__background {
  border-color: var(--%NS%mat-checkbox-selected-hover-icon-color, var(--%NS%mat-sys-primary));
  background-color: var(--%NS%mat-checkbox-selected-hover-icon-color, var(--%NS%mat-sys-primary));
}

.mdc-checkbox__native-control:focus:focus:not(:checked) ~ .mdc-checkbox__background,
.mdc-checkbox__native-control:focus:focus:not(:indeterminate) ~ .mdc-checkbox__background {
  border-color: var(--%NS%mat-checkbox-unselected-focus-icon-color, var(--%NS%mat-sys-on-surface));
}

.mdc-checkbox__native-control:focus:focus:checked ~ .mdc-checkbox__background,
.mdc-checkbox__native-control:focus:focus:indeterminate ~ .mdc-checkbox__background {
  border-color: var(--%NS%mat-checkbox-selected-focus-icon-color, var(--%NS%mat-sys-primary));
  background-color: var(--%NS%mat-checkbox-selected-focus-icon-color, var(--%NS%mat-sys-primary));
}

.mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox:hover > .mdc-checkbox__native-control ~ .mdc-checkbox__background,
.mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox .mdc-checkbox__native-control:focus ~ .mdc-checkbox__background,
.mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox__background {
  border-color: var(--%NS%mat-checkbox-disabled-unselected-icon-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));
}
@media (forced-colors: active) {
  .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox:hover > .mdc-checkbox__native-control ~ .mdc-checkbox__background,
  .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox .mdc-checkbox__native-control:focus ~ .mdc-checkbox__background,
  .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox__background {
    border-color: GrayText;
  }
}
.mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox__native-control:checked ~ .mdc-checkbox__background,
.mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox__native-control:indeterminate ~ .mdc-checkbox__background {
  background-color: var(--%NS%mat-checkbox-disabled-selected-icon-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));
  border-color: transparent;
}

.mdc-checkbox__checkmark {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  opacity: 0;
  transition: opacity 180ms cubic-bezier(0.4, 0, 0.6, 1);
  color: var(--%NS%mat-checkbox-selected-checkmark-color, var(--%NS%mat-sys-on-primary));
}
@media (forced-colors: active) {
  .mdc-checkbox__checkmark {
    color: CanvasText;
  }
}

.mdc-checkbox--disabled .mdc-checkbox__checkmark, .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox__checkmark {
  color: var(--%NS%mat-checkbox-disabled-selected-checkmark-color, var(--%NS%mat-sys-surface));
}
@media (forced-colors: active) {
  .mdc-checkbox--disabled .mdc-checkbox__checkmark, .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox__checkmark {
    color: GrayText;
  }
}

.mdc-checkbox__checkmark-path {
  transition: stroke-dashoffset 180ms cubic-bezier(0.4, 0, 0.6, 1);
  stroke: currentColor;
  stroke-width: 3.12px;
  stroke-dashoffset: 29.7833385;
  stroke-dasharray: 29.7833385;
}

.mdc-checkbox__mixedmark {
  width: 100%;
  height: 0;
  transform: scaleX(0) rotate(0deg);
  border-width: 1px;
  border-style: solid;
  opacity: 0;
  transition: opacity 90ms cubic-bezier(0.4, 0, 0.6, 1), transform 90ms cubic-bezier(0.4, 0, 0.6, 1);
  border-color: var(--%NS%mat-checkbox-selected-checkmark-color, var(--%NS%mat-sys-on-primary));
}
@media (forced-colors: active) {
  .mdc-checkbox__mixedmark {
    margin: 0 1px;
  }
}

.mdc-checkbox--disabled .mdc-checkbox__mixedmark, .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox__mixedmark {
  border-color: var(--%NS%mat-checkbox-disabled-selected-checkmark-color, var(--%NS%mat-sys-surface));
}
@media (forced-colors: active) {
  .mdc-checkbox--disabled .mdc-checkbox__mixedmark, .mdc-checkbox--disabled.mat-mdc-checkbox-disabled-interactive .mdc-checkbox__mixedmark {
    border-color: GrayText;
  }
}

.mdc-checkbox--anim-unchecked-checked .mdc-checkbox__background,
.mdc-checkbox--anim-unchecked-indeterminate .mdc-checkbox__background,
.mdc-checkbox--anim-checked-unchecked .mdc-checkbox__background,
.mdc-checkbox--anim-indeterminate-unchecked .mdc-checkbox__background {
  animation-duration: 180ms;
  animation-timing-function: linear;
}

.mdc-checkbox--anim-unchecked-checked .mdc-checkbox__checkmark-path {
  animation: mdc-checkbox-unchecked-checked-checkmark-path 180ms linear;
  transition: none;
}

.mdc-checkbox--anim-unchecked-indeterminate .mdc-checkbox__mixedmark {
  animation: mdc-checkbox-unchecked-indeterminate-mixedmark 90ms linear;
  transition: none;
}

.mdc-checkbox--anim-checked-unchecked .mdc-checkbox__checkmark-path {
  animation: mdc-checkbox-checked-unchecked-checkmark-path 90ms linear;
  transition: none;
}

.mdc-checkbox--anim-checked-indeterminate .mdc-checkbox__checkmark {
  animation: mdc-checkbox-checked-indeterminate-checkmark 90ms linear;
  transition: none;
}
.mdc-checkbox--anim-checked-indeterminate .mdc-checkbox__mixedmark {
  animation: mdc-checkbox-checked-indeterminate-mixedmark 90ms linear;
  transition: none;
}

.mdc-checkbox--anim-indeterminate-checked .mdc-checkbox__checkmark {
  animation: mdc-checkbox-indeterminate-checked-checkmark 500ms linear;
  transition: none;
}
.mdc-checkbox--anim-indeterminate-checked .mdc-checkbox__mixedmark {
  animation: mdc-checkbox-indeterminate-checked-mixedmark 500ms linear;
  transition: none;
}

.mdc-checkbox--anim-indeterminate-unchecked .mdc-checkbox__mixedmark {
  animation: mdc-checkbox-indeterminate-unchecked-mixedmark 300ms linear;
  transition: none;
}

.mdc-checkbox__native-control:checked ~ .mdc-checkbox__background,
.mdc-checkbox__native-control:indeterminate ~ .mdc-checkbox__background {
  transition: border-color 90ms cubic-bezier(0, 0, 0.2, 1), background-color 90ms cubic-bezier(0, 0, 0.2, 1);
}
.mdc-checkbox__native-control:checked ~ .mdc-checkbox__background > .mdc-checkbox__checkmark > .mdc-checkbox__checkmark-path,
.mdc-checkbox__native-control:indeterminate ~ .mdc-checkbox__background > .mdc-checkbox__checkmark > .mdc-checkbox__checkmark-path {
  stroke-dashoffset: 0;
}

.mdc-checkbox__native-control:checked ~ .mdc-checkbox__background > .mdc-checkbox__checkmark {
  transition: opacity 180ms cubic-bezier(0, 0, 0.2, 1), transform 180ms cubic-bezier(0, 0, 0.2, 1);
  opacity: 1;
}
.mdc-checkbox__native-control:checked ~ .mdc-checkbox__background > .mdc-checkbox__mixedmark {
  transform: scaleX(1) rotate(-45deg);
}

.mdc-checkbox__native-control:indeterminate ~ .mdc-checkbox__background > .mdc-checkbox__checkmark {
  transform: rotate(45deg);
  opacity: 0;
  transition: opacity 90ms cubic-bezier(0.4, 0, 0.6, 1), transform 90ms cubic-bezier(0.4, 0, 0.6, 1);
}
.mdc-checkbox__native-control:indeterminate ~ .mdc-checkbox__background > .mdc-checkbox__mixedmark {
  transform: scaleX(1) rotate(0deg);
  opacity: 1;
}

@keyframes mdc-checkbox-unchecked-checked-checkmark-path {
  0%, 50% {
    stroke-dashoffset: 29.7833385;
  }
  50% {
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
  100% {
    stroke-dashoffset: 0;
  }
}
@keyframes mdc-checkbox-unchecked-indeterminate-mixedmark {
  0%, 68.2% {
    transform: scaleX(0);
  }
  68.2% {
    animation-timing-function: cubic-bezier(0, 0, 0, 1);
  }
  100% {
    transform: scaleX(1);
  }
}
@keyframes mdc-checkbox-checked-unchecked-checkmark-path {
  from {
    animation-timing-function: cubic-bezier(0.4, 0, 1, 1);
    opacity: 1;
    stroke-dashoffset: 0;
  }
  to {
    opacity: 0;
    stroke-dashoffset: -29.7833385;
  }
}
@keyframes mdc-checkbox-checked-indeterminate-checkmark {
  from {
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    transform: rotate(0deg);
    opacity: 1;
  }
  to {
    transform: rotate(45deg);
    opacity: 0;
  }
}
@keyframes mdc-checkbox-indeterminate-checked-checkmark {
  from {
    animation-timing-function: cubic-bezier(0.14, 0, 0, 1);
    transform: rotate(45deg);
    opacity: 0;
  }
  to {
    transform: rotate(360deg);
    opacity: 1;
  }
}
@keyframes mdc-checkbox-checked-indeterminate-mixedmark {
  from {
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    transform: rotate(-45deg);
    opacity: 0;
  }
  to {
    transform: rotate(0deg);
    opacity: 1;
  }
}
@keyframes mdc-checkbox-indeterminate-checked-mixedmark {
  from {
    animation-timing-function: cubic-bezier(0.14, 0, 0, 1);
    transform: rotate(0deg);
    opacity: 1;
  }
  to {
    transform: rotate(315deg);
    opacity: 0;
  }
}
@keyframes mdc-checkbox-indeterminate-unchecked-mixedmark {
  0% {
    animation-timing-function: linear;
    transform: scaleX(1);
    opacity: 1;
  }
  32.8%, 100% {
    transform: scaleX(0);
    opacity: 0;
  }
}
.mat-mdc-checkbox {
  display: inline-block;
  position: relative;
  -webkit-tap-highlight-color: transparent;
}
.mat-mdc-checkbox._mat-animation-noopable > .mat-internal-form-field > .mdc-checkbox > .mat-mdc-checkbox-touch-target,
.mat-mdc-checkbox._mat-animation-noopable > .mat-internal-form-field > .mdc-checkbox > .mdc-checkbox__native-control,
.mat-mdc-checkbox._mat-animation-noopable > .mat-internal-form-field > .mdc-checkbox > .mdc-checkbox__ripple,
.mat-mdc-checkbox._mat-animation-noopable > .mat-internal-form-field > .mdc-checkbox > .mat-mdc-checkbox-ripple::before,
.mat-mdc-checkbox._mat-animation-noopable > .mat-internal-form-field > .mdc-checkbox > .mdc-checkbox__background,
.mat-mdc-checkbox._mat-animation-noopable > .mat-internal-form-field > .mdc-checkbox > .mdc-checkbox__background > .mdc-checkbox__checkmark,
.mat-mdc-checkbox._mat-animation-noopable > .mat-internal-form-field > .mdc-checkbox > .mdc-checkbox__background > .mdc-checkbox__checkmark > .mdc-checkbox__checkmark-path,
.mat-mdc-checkbox._mat-animation-noopable > .mat-internal-form-field > .mdc-checkbox > .mdc-checkbox__background > .mdc-checkbox__mixedmark {
  transition: none !important;
  animation: none !important;
}
.mat-mdc-checkbox label {
  cursor: pointer;
}
.mat-mdc-checkbox .mat-internal-form-field {
  color: var(--%NS%mat-checkbox-label-text-color, var(--%NS%mat-sys-on-surface));
  font-family: var(--%NS%mat-checkbox-label-text-font, var(--%NS%mat-sys-body-medium-font));
  line-height: var(--%NS%mat-checkbox-label-text-line-height, var(--%NS%mat-sys-body-medium-line-height));
  font-size: var(--%NS%mat-checkbox-label-text-size, var(--%NS%mat-sys-body-medium-size));
  letter-spacing: var(--%NS%mat-checkbox-label-text-tracking, var(--%NS%mat-sys-body-medium-tracking));
  font-weight: var(--%NS%mat-checkbox-label-text-weight, var(--%NS%mat-sys-body-medium-weight));
}
.mat-mdc-checkbox.mat-mdc-checkbox-disabled.mat-mdc-checkbox-disabled-interactive {
  pointer-events: auto;
}
.mat-mdc-checkbox.mat-mdc-checkbox-disabled.mat-mdc-checkbox-disabled-interactive input {
  cursor: default;
}
.mat-mdc-checkbox.mat-mdc-checkbox-disabled label {
  cursor: default;
}
.mat-mdc-checkbox.mat-mdc-checkbox-disabled .mat-internal-form-field-label {
  color: var(--%NS%mat-checkbox-disabled-label-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));
}
@media (forced-colors: active) {
  .mat-mdc-checkbox.mat-mdc-checkbox-disabled .mat-internal-form-field-label {
    color: GrayText;
  }
}
.mat-mdc-checkbox .mat-internal-form-field-label:empty {
  display: none;
}
.mat-mdc-checkbox .mdc-checkbox__ripple {
  opacity: 0;
}

.mat-mdc-checkbox .mat-mdc-checkbox-ripple,
.mdc-checkbox__ripple {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}
.mat-mdc-checkbox .mat-mdc-checkbox-ripple:not(:empty),
.mdc-checkbox__ripple:not(:empty) {
  transform: translateZ(0);
}

.mat-mdc-checkbox-ripple .mat-ripple-element {
  opacity: 0.1;
}

.mat-mdc-checkbox-touch-target {
  position: absolute;
  top: 50%;
  left: 50%;
  height: var(--%NS%mat-checkbox-touch-target-size, 48px);
  width: var(--%NS%mat-checkbox-touch-target-size, 48px);
  transform: translate(-50%, -50%);
  display: var(--%NS%mat-checkbox-touch-target-display, block);
}

.mat-mdc-checkbox .mat-mdc-checkbox-ripple::before {
  border-radius: 50%;
}

.mdc-checkbox__native-control:focus-visible ~ .mat-focus-indicator::before {
  content: "";
}
`],encapsulation:2})})()}return a})();var Ve=(a,n)=>n.category;function Ge(a,n){a&1&&(Wt(0,`pch-page`,0)(1,`div`,2),Ds(2,`pch-loading-indicator`),Yt()())}function qe(a,n){a&1&&(Wt(0,`pch-page`,0),Ds(1,`pch-empty-state`,3),Yt())}function je(a,n){a&1&&(Wt(0,`pch-card`,4),ws(1,`This Season doesn’t use lineups: every workout just counts.`),Yt())}function Ue(a,n){a&1&&(Wt(0,`pch-card`,6)(1,`span`,10),ws(2,`lock`),Yt(),ws(3,` The week has started, so this lineup is locked. `),Yt()),a&2&&Ch(`pchStagger`,0)}function Xe(a,n){a&1&&(Wt(0,`pch-card`,6)(1,`span`,10),ws(2,`event_upcoming`),Yt(),ws(3,` Lineups open a week before the week starts. `),Yt()),a&2&&Ch(`pchStagger`,0)}function He(a,n){if(a&1&&(Wt(0,`span`,17),ws(1),Yt()),a&2){let e=Es().$implicit;ke(),Hh(e.payoff)}}function Ye(a,n){if(a&1){let e=cd();Wt(0,`div`,18)(1,`button`,19),wr(`click`,function(){Ei(e);let o=Es().$implicit,i=Es(3);return wi(i.nudge(o.category,-1))}),Wt(2,`span`,10),ws(3,`remove`),Yt()(),Wt(4,`label`,20)(5,`input`,21),wr(`change`,function(o){Ei(e);let i=Es().$implicit,c=Es(3);return wi(c.setShown(i.category,o.target.value))}),Yt(),Wt(6,`span`,22),ws(7),Yt()(),Wt(8,`button`,23),wr(`click`,function(){Ei(e);let o=Es().$implicit,i=Es(3);return wi(i.nudge(o.category,1))}),Wt(9,`span`,10),ws(10,`add`),Yt()()()}if(a&2){let e=Es().$implicit,t=Es(3);ke(),Ch(`disabled`,t.locked()),ho(`aria-label`,`Less `+e.label),ke(4),Ch(`value`,e.shown)(`disabled`,t.locked()),ho(`aria-label`,e.label+` pledge in `+e.unit),ke(2),Hh(e.unit),ke(),Ch(`disabled`,t.locked()),ho(`aria-label`,`More `+e.label)}}function We(a,n){if(a&1){let e=cd();Wt(0,`div`,11)(1,`mat-checkbox`,12),wr(`change`,function(o){let i=Ei(e).$implicit,c=Es(3);return wi(c.toggle(i.category,o.checked))}),Yt(),Wt(2,`span`,13),ws(3),Yt(),Wt(4,`div`,14)(5,`span`,15),ws(6),Yt(),Wt(7,`span`,16),ws(8),Yt(),Wt(9,`span`,16),ws(10),Yt(),Gt(11,He,2,1,`span`,17),Yt(),Gt(12,Ye,11,8,`div`,18),Yt()}if(a&2){let e=n.$implicit,t=Es(3);Ce(`picked`,e.shown!==null),ke(),Ch(`checked`,e.shown!==null)(`disabled`,t.locked()||t.notYet()||e.shown===null&&t.full()),wh(`aria-label`,`Pledge `+e.label),ke(2),Hh(e.icon),ke(3),Hh(e.label),ke(2),Hh(e.value),ke(2),Hh(e.form),ke(),qt(e.payoff?11:-1),ke(),qt(e.shown!==null?12:-1)}}function Ze(a,n){if(a&1){let e=cd();Wt(0,`button`,24),wr(`click`,function(){Ei(e);let o=Es(3);return wi(o.save())}),ws(1),Yt()}if(a&2){let e=Es(3);Ch(`disabled`,e.busy()),ke(),Uh(` Set lineup · `,e.draft().size,` of `,e.slots(),` `)}}function Qe(a,n){if(a&1&&(Wt(0,`p`,5),ws(1),Yt(),Gt(2,Ue,4,1,`pch-card`,6)(3,Xe,4,1,`pch-card`,6),Wt(4,`pch-list-card`,7),BE(5,We,13,11,`div`,8,Ve),Yt(),Gt(7,Ze,2,3,`button`,9)),a&2){let e=Es(2);Ch(`pchStagger`,0),ke(),Hh(e.explainer()),ke(),qt(e.locked()?2:e.notYet()?3:-1),ke(2),Ch(`pchStagger`,1),ke(),jE(e.rows()),ke(2),qt(!e.locked()&&!e.notYet()?7:-1)}}function Ke(a,n){if(a&1&&(Wt(0,`pch-page`,1),Gt(1,je,2,0,`pch-card`,4)(2,Qe,8,5),Yt()),a&2){let e=Es();Ch(`title`,e.title())(`subtitle`,e.subtitle())(`backLink`,`/matchups/`+e.matchupId()),ke(),qt(e.slots()===0?1:2)}}var Le=3;var Je=6048e5;function De(a,n){switch(a){case`runWalk`:return 1;case`ride`:return 5;case`swimRow`:return 250;case`weightMoved`:return n===`imperial`?1e3:500;case`reps`:return 25;default:return 15}}var Ae=class a{matchupId=mg.required();state=f(Rb);router=f(Ee);busy=X(!1);data=this.state.query(()=>{let n=this.state.peachId();return n?{id:this.matchupId(),me:n}:void 0},async({id:n,me:e},t)=>{let o=await t.seasonService.board(n);if(!o)return null;let i=o.home.peachId===e?o.home:o.away;if(!i)return null;let c=i===o.home?o.away:o.home,l=new Date(o.window.opensAt.getTime()-Le*Je),[u,R]=await Promise.all([t.logs.sharedWith(o.crate.id,l,o.window.opensAt),c?t.peaches.getById(c.peachId):null]),z=Oe=>{let Re=t.scoring.totalsOf(u.filter(T=>T.peachId===Oe));return Object.fromEntries(s.map(T=>[T,Re[T]/Le]))};return{board:o,mine:i,opponentName:R?.displayName??null,myForm:z(e),theirForm:c?z(c.peachId):null}});draft=X(new Map);touched=X(!1);constructor(){$t(()=>{let n=this.data.value();!n||this.touched()||this.draft.set(new Map(n.mine.lineup?.pledges.map(e=>[e.category,e.target])??[]))})}locked=ve(()=>{let n=this.data.value();return!!n&&P({locksAt:n.board.window.opensAt},this.state.nowTick())});notYet=ve(()=>{let n=this.data.value();return!!n&&n.board.window.opensAt.getTime()-this.state.nowTick().getTime()>6048e5});rules=ve(()=>this.data.value()?.board.season.rules??null);slots=ve(()=>this.rules()?.lineup.slots??0);title=ve(()=>{let n=this.data.value();return n?`Week ${n.board.round.index+1} lineup`:`Lineup`});subtitle=ve(()=>{let n=this.data.value();if(!n)return``;let e=n.opponentName?`vs ${n.opponentName}`:`Bye week`,t=this.locked()?`Locked`:`Locks ${g$1.day(n.board.round.weekStart)}, ${g$1.time(n.board.window.opensAt)}`;return`${e} \xB7 ${n.board.crate.name} \xB7 ${t}`});explainer=ve(()=>{let n=this.rules(),e=this.data.value();if(!n||!e)return``;let t=e.opponentName??`your opponent`,o=e.opponentName&&n.lineup.battlePars>0?` Do more of a pledged category than ${t} and you win its battle: ${g$1.count(n.lineup.battlePars,`par`)} of its points.`:``,i=e.opponentName?` ${e.opponentName} sees your lineup only once the week starts.`:``;return`Pick up to ${g$1.count(n.lineup.slots,`category`,`categories`)} and pledge how much you\u2019ll do this week. Hit a pledge and you earn ${n.lineup.pledgeBonus}% of its points again.${o}${i}`});rows=ve(()=>{let n=this.data.value(),e=this.rules();if(!n||!e)return[];let t=this.state.units(),o=this.draft(),i=(c,l)=>`${l&&l[c]>0?`~`:``}${g$1.amount(c,l?.[c]??0,t)}`;return s.filter(c=>e.weights[c]>0).map(c=>{let l=o.get(c)??null,u=e.weights[c],R=l===null?0:u*l*e.lineup.pledgeBonus/100/j[c].par,z=n.opponentName&&e.lineup.battlePars>0?` \xB7 Beat ${n.opponentName}: +${g$1.points(u*e.lineup.battlePars)}`:``;return{category:c,label:g$1.category(c),icon:g$1.categoryIcon(c),unit:g$1.unit(c,t),value:`${u} pts ${g$1.per(c,j[c].par,t)}`,form:[`You ${i(c,n.myForm)}`,n.opponentName?`${n.opponentName} ${i(c,n.theirForm)}`:null].filter(Boolean).join(` · `)+` a week lately`,shown:l===null?null:Fe(g$1.toDisplay(c,l,t)),payoff:l===null?null:`Hit it: +${g$1.points(Fe(R))}${z}`}})});full=ve(()=>this.draft().size>=this.slots());toggle(n,e){let t=this.data.value();if(!t)return;let o=new Map(this.draft());if(e){let i=this.state.units(),c=De(n,i),l=t.myForm[n]>0?t.myForm[n]:j[n].par,u=Math.max(c,Math.round(g$1.toDisplay(n,l,i)/c)*c);o.set(n,g$1.fromDisplay(n,u,i))}else o.delete(n);this.touched.set(!0),this.draft.set(o)}nudge(n,e){let t=this.draft().get(n);if(t===void 0)return;let o=this.state.units(),i=De(n,o),c=Math.round(g$1.toDisplay(n,t,o)/i)*i+e*i;this.setShown(n,String(Math.max(i,c)))}setShown(n,e){let t=Number(e.trim());!Number.isFinite(t)||t<=0||!this.draft().has(n)||(this.touched.set(!0),this.draft.update(o=>new Map(o).set(n,g$1.fromDisplay(n,t,this.state.units()))))}async save(){let n=this.data.value(),e=this.state.peachId();if(!n||!e||this.busy())return;let t=s.filter(i=>this.draft().has(i)).map(i=>({category:i,target:this.draft().get(i)}));this.busy.set(!0);let o=await this.state.run(i=>i.lineupService.setLineup({roundId:n.board.round.id,peachId:e,pledges:t,now:this.state.now()}),`Lineup set. Good luck.`);this.busy.set(!1),o&&await this.router.navigate([`/matchups`,this.matchupId()])}static ɵfac=function(e){return new(e||a)};static ɵcmp=ie({type:a,selectors:[[`pch-lineup-page`]],inputs:{matchupId:[1,`matchupId`]},decls:3,vars:1,consts:[[`title`,`Lineup`,`showBack`,``,`backLink`,`/`],[`showBack`,``,3,`title`,`subtitle`,`backLink`],[1,`loading`],[`icon`,`search_off`,`title`,`Matchup not found`],[`variant`,`outlined`],[1,`intro`,`pch-body-large`,3,`pchStagger`],[`variant`,`filled`,1,`note`,3,`pchStagger`],[3,`pchStagger`],[1,`category`,3,`picked`],[`pageBottomBar`,``,`matButton`,`filled`,`type`,`button`,1,`save`,3,`disabled`],[`aria-hidden`,`true`,1,`material-symbols-rounded`],[1,`category`],[3,`change`,`checked`,`disabled`,`aria-label`],[`aria-hidden`,`true`,1,`material-symbols-rounded`,`icon`],[1,`what`],[1,`pch-title-medium`],[1,`pch-body-small`,`muted`],[1,`pch-label-medium`,`payoff`],[1,`stepper`],[`matIconButton`,``,`type`,`button`,1,`outlined`,3,`click`,`disabled`],[1,`field`],[`inputmode`,`decimal`,`autocomplete`,`off`,1,`pch-title-medium`,3,`change`,`value`,`disabled`],[`aria-hidden`,`true`,1,`pch-label-small`,`unit`],[`matIconButton`,``,`type`,`button`,1,`tonal`,3,`click`,`disabled`],[`pageBottomBar`,``,`matButton`,`filled`,`type`,`button`,1,`save`,3,`click`,`disabled`]],template:function(e,t){if(e&1&&Gt(0,Ge,3,0,`pch-page`,0)(1,qe,2,0,`pch-page`,0)(2,Ke,3,4,`pch-page`,1),e&2){let o=t.data.value();qt(o===void 0?0:o===null?1:2)}},dependencies:[l,x,d,oe,db,Te,ES,de,me],styles:[`.loading[_ngcontent-%COMP%]{display:flex;justify-content:center;padding:48px 0}.muted[_ngcontent-%COMP%]{color:var(--%NS%mat-sys-on-surface-variant)}.intro[_ngcontent-%COMP%]{margin:0 0 16px}.note[_ngcontent-%COMP%]{display:flex;align-items:center;gap:12px;margin-bottom:16px}.category[_ngcontent-%COMP%]{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 16px 12px 4px}.category.picked[_ngcontent-%COMP%]{background:color-mix(in srgb,var(--%NS%mat-sys-primary-container) 40%,transparent)}.icon[_ngcontent-%COMP%]{color:var(--%NS%mat-sys-on-surface-variant)}.what[_ngcontent-%COMP%]{display:flex;flex:1;flex-direction:column;min-width:160px}.payoff[_ngcontent-%COMP%]{margin-top:4px;color:var(--%NS%mat-sys-primary)}.stepper[_ngcontent-%COMP%]{display:flex;align-items:center;gap:4px;margin-inline-start:auto}.stepper[_ngcontent-%COMP%]   .outlined[_ngcontent-%COMP%]{border:1px solid var(--%NS%mat-sys-outline-variant)}.stepper[_ngcontent-%COMP%]   .tonal[_ngcontent-%COMP%]{background:var(--%NS%mat-sys-secondary-container);color:var(--%NS%mat-sys-on-secondary-container)}.field[_ngcontent-%COMP%]{display:flex;flex-direction:column;align-items:center}.field[_ngcontent-%COMP%]   input[_ngcontent-%COMP%]{width:72px;border:0;border-bottom:1px solid var(--%NS%mat-sys-outline);background:none;color:var(--%NS%mat-sys-on-surface);text-align:center;font-variant-numeric:tabular-nums}.field[_ngcontent-%COMP%]   input[_ngcontent-%COMP%]:focus{outline:none;border-bottom:2px solid var(--%NS%mat-sys-primary)}.field[_ngcontent-%COMP%]   .unit[_ngcontent-%COMP%]{color:var(--%NS%mat-sys-on-surface-variant)}.save[_ngcontent-%COMP%]{width:100%}`]})};function Fe(a){return Math.round(a*10)/10}export{Ae as LineupPage};