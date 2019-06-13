import typescript from 'rollup-plugin-typescript';

export default {
  input: './lib/index.ts',
  plugins: [typescript()],
};
