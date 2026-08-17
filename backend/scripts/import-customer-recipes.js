/**
 * Загрузка производственных рецептур ВИЛАР (очистка + справочники из customer_recipes.json).
 * Рабочую базу затирает — только локально / по явной админ-операции.
 */
import { applyCustomerRecipes } from '../src/services/customerRecipes.js';
import { loadCustomerRecipes } from '../src/services/dataMaintenance.js';

const force = process.argv.includes('--force');
const noClear = process.argv.includes('--no-clear');

if (noClear) {
  const result = applyCustomerRecipes();
  console.log('Imported without clear:', result);
} else if (force) {
  const result = loadCustomerRecipes();
  console.log('Customer recipes loaded:', result);
} else {
  console.error('Очищает рабочую базу. Укажите --force (очистка + импорт) или --no-clear (только в пустые справочники).');
  process.exit(1);
}
