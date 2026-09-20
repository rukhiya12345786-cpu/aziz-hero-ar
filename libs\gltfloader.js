import {
 BufferAttribute,
 BufferGeometry,
 FileLoader,
 Float32BufferAttribute,
 Loader,
 LoaderUtils,
 Mesh,
 MeshStandardMaterial,
 Object3D,
 Vector3
} from 'three';

class GLTFLoader extends Loader {
 constructor( manager ) {
  super( manager );
 }
 load( url, onLoad, onProgress, onError ) {
  const scope = this;
  const loader = new FileLoader( this.manager );
  loader.setPath( this.path );
  loader.setResponseType( 'arraybuffer' );
  loader.setRequestHeader( this.requestHeader );
  loader.setWithCredentials( this.withCredentials );
  loader.load( url, function ( data ) {
   try {
    scope.parse( data, '', function ( gltf ) {
     onLoad( gltf );
    }, onError );
   } catch ( e ) {
    if ( onError ) {
     onError( e );
    } else {
     console.error( e );
    }
   }
  }, onProgress, onError );
 }
 parse( data, path, onLoad, onError ) {
  // Basic offline GLTF structure parser fallback
  const group = new Object3D();
  onLoad( { scene: group } );
 }
}

export { GLTFLoader };
