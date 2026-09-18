import { resolve } from 'path';

import alias from '@rollup/plugin-alias';
import dts from 'rollup-plugin-dts';

const APP_SRC = resolve(process.cwd(), '../../src');

/** Drop style side-effect imports (import './x.scss') from the type bundle. */
const ignoreStyles = {
    name: 'ignore-styles',
    resolveId(id) {
        if (id.endsWith('.scss') || id.endsWith('.css')) {
            return { id, moduleSideEffects: false };
        }
        return null;
    },
    load(id) {
        if (id.endsWith('.scss') || id.endsWith('.css')) {
            return '';
        }
        return null;
    },
};

export default {
    input: 'src/index.ts',
    output: {
        file: 'dist/index.d.ts',
        format: 'es',
    },
    plugins: [
        ignoreStyles,
        alias({
            entries: [{ find: /^@\//, replacement: `${APP_SRC}/` }],
        }),
        dts({ tsconfig: './tsconfig.json' }),
    ],
};
