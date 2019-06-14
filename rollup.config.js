import typescript from 'rollup-plugin-typescript';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';
import builtins from 'builtin-modules';

export default {
  input: './lib/index.ts',
  output: [
    {
      format: 'cjs',
      file: 'dist/index.cjs.js',
    },
    {
      format: 'esm',
      file: 'dist/index.esm.js',
    },
  ],
  externals: builtins,
  plugins: [
    json(),
    typescript(),
    resolve({ preferBuiltins: true }),
    commonjs({
      namedExports: {
        'node_modules/lru_map/lru.js': ['LRUMap'],
      },
    }),
  ],
};
