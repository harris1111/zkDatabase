import typescript from '@rollup/plugin-typescript';
import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';

export default [
  {
    input: 'src/index.ts',
    output: {
      entryFileNames: 'src/index.js',
      format: 'esm',
      dir: 'build',
      preserveModules: false, // If will build to a single index.js file if it 'false'
      sourcemap: true,
    },
    plugins: [
      commonjs(),
      alias({
        entries: [
          { find: '@', replacement: 'src' },
          { find: '@helper', replacement: 'src/helper' },
          { find: '@common', replacement: 'src/common' },
          { find: '@database', replacement: 'src/database' },
        ],
      }),
      typescript({ sourceMap: true, tsconfig: 'tsconfig.json' }),
    ],
  },
];
