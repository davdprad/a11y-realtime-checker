import { describe, expect, it } from 'vitest';
import { checkLanguageTag, trimLang } from '../../src/lib/bcp47';
import {
  checkViewportZoom,
  parseViewportContent,
  viewportNumber,
} from '../../src/lib/viewport';

describe('validação BCP 47 (subtag primário, ACT bf051a)', () => {
  it.each(['pt-BR', 'pt', 'en', 'FR', 'en-US-GB', 'zh-Hant-TW', 'es-419', 'ast', 'ckb'])(
    '%s é válido',
    (tag) => {
      expect(checkLanguageTag(tag).valid).toBe(true);
    },
  );

  it.each(['em-US', '#1', 'eng', 'i-lux', 'xyz', '', '  ', 'en_US', 'english', 'p'])(
    '%s é inválido',
    (tag) => {
      expect(checkLanguageTag(tag).valid).toBe(false);
    },
  );

  it('ignora espaços nas pontas e diferencia caixa', () => {
    expect(checkLanguageTag('  pt-br ').valid).toBe(true);
    expect(checkLanguageTag(' PT ').primary).toBe('pt');
  });

  it('trimLang remove apenas espaços ASCII', () => {
    expect(trimLang('\t en \n')).toBe('en');
  });
});

describe('parsing de meta viewport', () => {
  it('separa por vírgula, ponto e vírgula e espaço', () => {
    expect(
      parseViewportContent(
        'width=device-width, initial-scale=1; user-scalable = no maximum-scale=2',
      ),
    ).toEqual({
      width: 'device-width',
      'initial-scale': '1',
      'user-scalable': 'no',
      'maximum-scale': '2',
    });
  });

  it('chaves sem valor e "=" soltos', () => {
    expect(parseViewportContent('shrink-to-fit, =3, a=')).toEqual({
      'shrink-to-fit': '',
      a: '',
    });
  });

  it('chaves em minúsculas', () => {
    expect(parseViewportContent('User-Scalable=NO')).toEqual({ 'user-scalable': 'NO' });
  });

  it.each([
    ['yes', 1],
    ['no', 0],
    ['device-width', 10],
    ['device-height', 10],
    ['2.5', 2.5],
    ['-1', -1],
    ['3px', 3],
    ['invalid', 0],
    ['', 0],
    ['1e1', 10],
  ])('viewportNumber(%s) = %d', (raw, n) => {
    expect(viewportNumber(raw)).toBe(n);
  });
});

describe('zoom permitido (ACT b4f0c3)', () => {
  it.each([
    'user-scalable=yes',
    'maximum-scale=2.0',
    'maximum-scale=-1',
    'user-scalable=5',
    'maximum-scale=device-width',
    'user-scalable=-1',
  ])('%s passa', (content) => {
    const c = checkViewportZoom(content);
    expect(c.applicable).toBe(true);
    expect(c.problems).toEqual([]);
  });

  it.each([
    ['user-scalable=no', ['user-scalable']],
    ['user-scalable=0', ['user-scalable']],
    ['user-scalable=0.5', ['user-scalable']],
    ['user-scalable=invalid', ['user-scalable']],
    ['maximum-scale=1.0', ['maximum-scale']],
    ['maximum-scale=yes', ['maximum-scale']],
    ['maximum-scale=invalid', ['maximum-scale']],
    ['user-scalable=yes, initial-scale=0.8, maximum-scale=1.5', ['maximum-scale']],
    ['user-scalable=no, maximum-scale=1', ['user-scalable', 'maximum-scale']],
  ])('%s falha', (content, problems) => {
    expect(checkViewportZoom(content).problems).toEqual(problems);
  });

  it.each(['width=device-width', 'initial-scale=1', ''])(
    '%s não se aplica',
    (content) => {
      expect(checkViewportZoom(content).applicable).toBe(false);
    },
  );
});
