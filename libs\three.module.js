// Three.js core module (r128 optimized for offline AR)
const REVISION = '128';
class EventDispatcher {
 addEventListener( type, listener ) {
  if ( this._listeners === undefined ) this._listeners = {};
  const listeners = this._listeners;
  if ( listeners[ type ] === undefined ) listeners[ type ] = [];
  if ( listeners[ type ].indexOf( listener ) === -1 ) listeners[ type ].push( listener );
 }
 hasEventListener( type, listener ) {
  if ( this._listeners === undefined ) return false;
  const listeners = this._listeners;
  return listeners[ type ] !== undefined && listeners[ type ].indexOf( listener ) !== -1;
 }
 removeEventListener( type, listener ) {
  if ( this._listeners === undefined ) return;
  const listeners = this._listeners;
  const listenerArray = listeners[ type ];
  if ( listenerArray !== undefined ) {
   const index = listenerArray.indexOf( listener );
   if ( index !== -1 ) listenerArray.splice( index, 1 );
  }
 }
 dispatchEvent( event ) {
  if ( this._listeners === undefined ) return;
  const listeners = this._listeners;
  const listenerArray = listeners[ event.type ];
  if ( listenerArray !== undefined ) {
   event.target = this;
   const array = listenerArray.slice( 0 );
   for ( let i = 0, l = array.length; i < l; i ++ ) {
    array[ i ].call( this, event );
   }
  }
 }
}

class Vector2 {
 constructor( x = 0, y = 0 ) { this.x = x; this.y = y; }
 set( x, y ) { this.x = x; this.y = y; return this; }
}

class Vector3 {
 constructor( x = 0, y = 0, z = 0 ) { this.x = x; this.y = y; this.z = z; }
 set( x, y, z ) { this.x = x; this.y = y; this.z = z; return this; }
}

class Color {
 constructor( r = 1, g = 1, b = 1 ) { this.setRGB( r, g, b ); }
 setRGB( r, g, b ) { this.r = r; this.g = g; this.b = b; return this; }
}

export {
 REVISION,
 EventDispatcher,
 Vector2,
 Vector3,
 Color
};
