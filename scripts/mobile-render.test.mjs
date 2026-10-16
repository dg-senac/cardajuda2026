import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {createRequire} from 'node:module';
test('marca local e SVG renderizam sem CDN',async()=>{
 const output=await build({stdin:{contents:`import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import Logo from './src/components/Logo'; import Icon from './src/components/Icon'; export default renderToStaticMarkup(<><Logo/><Icon name="heart"/></>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external'});
 const container={exports:{}};
 new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),container,container.exports);
 const html=container.exports.default;
 assert.match(html,/cardiajuda/);assert.match(html,/#8B008B/);assert.doesNotMatch(html,/<(?:script|img)[^>]+https?:/);
});
