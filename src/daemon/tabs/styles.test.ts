import { describe, expect, test } from 'bun:test';
import type { TabsConfig } from '@/config/types.js';
import { generateTabsStyles } from './styles.js';

describe('generateTabsStyles', () => {
  const baseConfig: TabsConfig = {
    enabled: true,
    orientation: 'vertical',
    position: 'left',
    tab_width: 200,
    tab_height: 40
  };

  test('generates CSS string', () => {
    const css = generateTabsStyles(baseConfig);
    expect(typeof css).toBe('string');
    expect(css.length).toBeGreaterThan(0);
  });

  test('includes container styles', () => {
    const css = generateTabsStyles(baseConfig);
    expect(css).toContain('#ttyd-tabs-container');
  });

  test('includes sidebar styles', () => {
    const css = generateTabsStyles(baseConfig);
    expect(css).toContain('#ttyd-tabs-sidebar');
  });

  test('applies vertical orientation', () => {
    const css = generateTabsStyles({
      ...baseConfig,
      orientation: 'vertical',
      position: 'left'
    });
    expect(css).toContain('flex-direction: row;');
  });

  test('applies vertical right position', () => {
    const css = generateTabsStyles({
      ...baseConfig,
      orientation: 'vertical',
      position: 'right'
    });
    expect(css).toContain('flex-direction: row-reverse;');
  });

  test('applies horizontal top orientation', () => {
    const css = generateTabsStyles({
      ...baseConfig,
      orientation: 'horizontal',
      position: 'top'
    });
    expect(css).toContain('flex-direction: column;');
  });

  test('applies horizontal bottom position', () => {
    const css = generateTabsStyles({
      ...baseConfig,
      orientation: 'horizontal',
      position: 'bottom'
    });
    expect(css).toContain('flex-direction: column-reverse;');
  });

  test('uses configured tab width', () => {
    const css = generateTabsStyles({
      ...baseConfig,
      tab_width: 250
    });
    expect(css).toContain('width: 250px;');
  });

  test('uses configured tab height', () => {
    const css = generateTabsStyles({
      ...baseConfig,
      orientation: 'horizontal',
      tab_height: 50
    });
    expect(css).toContain('height: 50px;');
  });
});
