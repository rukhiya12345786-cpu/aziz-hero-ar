import {
 BufferAttribute,
 BufferGeometry,
 FileLoader,
 Float32BufferAttribute,
 Loader,
 Mesh,
 MeshStandardMaterial,
 Group
} from 'three';

class OBJLoader extends Loader {
 constructor( manager ) {
  super( manager );
 }
 load( url, onLoad, onProgress, onError ) {
  const scope = this;
  const loader = new FileLoader( this.manager );
  loader.setPath( this.path );
  loader.load( url, function ( text ) {
   try {
    onLoad( scope.parse( text ) );
   } catch ( e ) {
    if ( onError ) { onError( e ); } else { console.error( e ); }
   }
  }, onProgress, onError );
 }
 parse( text ) {
  const container = new Group();
  const geometry = new BufferGeometry();
  const material = new MeshStandardMaterial();
  const mesh = new Mesh( geometry, material );
  container.add( mesh );
  return container;
 }
}

export { OBJLoader };
