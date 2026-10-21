import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import ts from 'typescript-eslint';

export default defineConfig(js.configs.recommended, ts.configs.recommended, prettier);
