import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
export default {
    input: 'index.js',
    output: {
        file: 'dist/node-relay.js',
        format: 'cjs',
    },
    plugins: [
        nodeResolve({
            modulesOnly: true
        }),
        commonjs()
    ],
};