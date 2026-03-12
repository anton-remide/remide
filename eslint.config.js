import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const INLINE_DYNAMIC_MARKER_RE = /inline-dynamic-ok:\s*.+/i
const BOOTSTRAP_GRID_CLASS_RE = /(^|\s)(row|col-(?:\d+|sm-\d+|md-\d+|lg-\d+|xl-\d+)|g-\d+)(?=\s|$)/
const INLINE_STYLE_LEGACY_ALLOWLIST = [
  'src/App.tsx',
  'src/components/auth/ProtectedRoute.tsx',
  'src/components/layout/ErrorBoundary.tsx',
  'src/components/map/WorldMap.tsx',
  'src/components/ui/Badge.tsx',
  'src/components/ui/Breadcrumb.tsx',
  'src/components/ui/ColumnHeaderFilter.tsx',
  'src/components/ui/ContactForm.tsx',
  'src/components/ui/DataTable.tsx',
  'src/components/ui/FilterChips.tsx',
  'src/components/ui/PaywallGate.tsx',
  'src/components/ui/PaywallOverlay.tsx',
  'src/components/ui/StatCard.tsx',
  'src/pages/AuthCallbackPage.tsx',
  'src/pages/CbdcDetailPage.tsx',
  'src/pages/EntitiesPage.tsx',
  'src/pages/EntityDetailPage.tsx',
  'src/pages/IssuerDetailPage.tsx',
  'src/pages/JurisdictionDetailPage.tsx',
  'src/pages/JurisdictionsPage.tsx',
  'src/pages/LandingPage.tsx',
  'src/pages/LoginPage.tsx',
  'src/pages/NotFoundPage.tsx',
  'src/pages/PricingPage.tsx',
  'src/pages/SignupPage.tsx',
  'src/pages/StablecoinDetailPage.tsx',
  'src/pages/WelcomePage.tsx',
]

const isStaticStyleValue = (node) => {
  if (!node) return true
  switch (node.type) {
    case 'Literal':
      return true
    case 'TemplateLiteral':
      return node.expressions.length === 0
    case 'UnaryExpression':
      return ['+', '-'].includes(node.operator) && isStaticStyleValue(node.argument)
    case 'ObjectExpression':
      return node.properties.every((property) => {
        if (property.type !== 'Property') return false
        if (property.computed) return false
        return isStaticStyleValue(property.value)
      })
    case 'ArrayExpression':
      return node.elements.every((element) => isStaticStyleValue(element))
    default:
      return false
  }
}

const remideStylePlugin = {
  rules: {
    'inline-style-policy': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow new inline styles except dynamic cases with explicit marker',
        },
        schema: [],
      },
      create(context) {
        const sourceCode = context.sourceCode
        const filename = context.filename
        const isAllowlisted = INLINE_STYLE_LEGACY_ALLOWLIST.some((path) => filename.endsWith(path))
        if (isAllowlisted) return {}

        return {
          JSXAttribute(node) {
            if (node.name?.name !== 'style') return
            if (!node.value || node.value.type !== 'JSXExpressionContainer') {
              context.report({
                node,
                message: 'Inline styles are disallowed. Move style definitions to CSS classes/tokens.',
              })
              return
            }

            const comments = [
              ...sourceCode.getCommentsBefore(node),
              ...sourceCode.getCommentsBefore(node.parent),
            ]
            const hasMarker = comments.some((comment) => INLINE_DYNAMIC_MARKER_RE.test(comment.value))
            const isDynamic = !isStaticStyleValue(node.value.expression)

            if (isDynamic && hasMarker) return

            context.report({
              node,
              message: isDynamic
                ? 'Dynamic inline style requires marker: inline-dynamic-ok: <reason>.'
                : 'Inline styles are disallowed. Move style definitions to CSS classes/tokens.',
            })
          },
        }
      },
    },
    'no-bootstrap-grid-classes': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow bootstrap grid classes in JSX className',
        },
        schema: [],
      },
      create(context) {
        const extractClassText = (node) => {
          if (!node || node.type !== 'JSXAttribute' || node.name?.name !== 'className') return null
          if (!node.value) return null
          if (node.value.type === 'Literal') return String(node.value.value ?? '')
          if (node.value.type !== 'JSXExpressionContainer') return null
          if (node.value.expression.type === 'Literal') return String(node.value.expression.value ?? '')
          if (node.value.expression.type === 'TemplateLiteral') {
            return node.value.expression.quasis.map((part) => part.value.cooked ?? '').join(' ')
          }
          return null
        }

        return {
          JSXAttribute(node) {
            const classText = extractClassText(node)
            if (!classText) return
            if (!BOOTSTRAP_GRID_CLASS_RE.test(classText)) return

            context.report({
              node,
              message: 'Bootstrap grid classes are disallowed. Use st-form-grid / st-* layout classes.',
            })
          },
        }
      },
    },
  },
}

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      remide: remideStylePlugin,
    },
    rules: {
      'remide/inline-style-policy': 'error',
      'remide/no-bootstrap-grid-classes': 'error',
    },
  },
])
