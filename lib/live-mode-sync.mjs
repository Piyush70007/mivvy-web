// Reconcile native commands, the display selector and server heartbeats.
// A response which began before a local switch cannot undo that switch.
export class LiveModeSync{
 constructor(kind='screen',monitor=1){this.current={kind,monitor};this.version=0;this.pending=false}
 begin(kind,monitor){
  if(this.current.kind===kind&&this.current.monitor===monitor)return null;
  this.current={kind,monitor};this.pending=true;this.version++;
  return {version:this.version,mode:{...this.current}};
 }
 finish(version,mode){
  if(version!==this.version)return false;
  this.pending=false;this.current={kind:mode.kind,monitor:mode.monitor};return true;
 }
 fail(version){if(version===this.version)this.pending=false}
 observe(mode,version){
  if(this.pending||version!==this.version)return false;
  this.current={kind:mode.kind,monitor:mode.monitor};return true;
 }
}
