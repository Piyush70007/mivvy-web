// An interrupted owner chat may already have queued a laptop action. Cancel
// that exact request ID; never infer which job the server is currently running.
export class LaptopTurn {
 constructor(cancel,makeID=()=>crypto.randomUUID()){this.cancel=cancel;this.makeID=makeID;this.id=null}
 begin(owner){this.stop();this.id=owner?this.makeID():null;return this.id}
 complete(id){if(this.id===id)this.id=null}
 stop(){const id=this.id;this.id=null;if(id)this.cancel(id)}
}
