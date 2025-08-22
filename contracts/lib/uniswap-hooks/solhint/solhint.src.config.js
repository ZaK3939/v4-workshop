const customRules = require('solhint-plugin-openzeppelin');
const { baseRules } = require('./solhint.base.config');

/// @dev Rules applied to `src/` files only.
const srcOnlyRules = {
  // 'ordering', @TBD
  'func-visibility': ['error', { "ignoreConstructors": true }],
  'func-name-mixedcase': 'error',
  'state-visibility': 'error', 
  'gas-custom-errors': 'error', 
  'gas-calldata-parameters': 'warn', 
  'gas-struct-packing': 'warn',
}

module.exports = {
  plugins: ['openzeppelin'],
  rules: { 
    ...Object.fromEntries(customRules.map(r => [`openzeppelin/${r.ruleId}`, 'error'])),
    ...baseRules,
    ...srcOnlyRules,
  },
};
