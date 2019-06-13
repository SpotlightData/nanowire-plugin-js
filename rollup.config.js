import typescript from 'rollup-plugin-typescript';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

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
  plugins: [typescript(), resolve(), commonjs()],
};
