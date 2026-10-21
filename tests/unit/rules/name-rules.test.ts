import { describe, expect, it } from 'vitest';
import { buttonName } from '../../../src/rules/button-name';
import { formLabel } from '../../../src/rules/form-label';
import { imageButtonName, imageName, svgImgName } from '../../../src/rules/image-name';
import { linkName } from '../../../src/rules/link-name';
import { check, evaluate, mount, q } from '../helpers';

describe('1.1.1 image-name', () => {
  it.each([
    ['<img data-t src="x.png">', 'violation'],
    ['<img data-t src="x.png" alt=" ">', 'violation'],
    ['<div data-t role="img" style="width:10px;height:10px"></div>', 'violation'],
    ['<img data-t role="none" tabindex="0" src="x.png">', 'violation'],
    ['<img data-t src="x.png" alt="Logo">', 'pass'],
    ['<img data-t src="x.png" title="Logo">', 'pass'],
    ['<span id="l">Logo</span><img data-t src="x.png" aria-labelledby="l">', 'pass'],
    ['<img data-t src="x.png" alt="">', 'inapplicable'],
    ['<img data-t src="x.png" role="presentation">', 'inapplicable'],
    ['<img data-t src="x.png" aria-hidden="true">', 'inapplicable'],
    ['<div style="display:none"><img data-t src="x.png"></div>', 'inapplicable'],
    ['<div style="visibility:hidden"><img data-t src="x.png"></div>', 'inapplicable'],
    ['<div inert><img data-t src="x.png"></div>', 'inapplicable'],
    ['<div style="margin-left:-9999px"><img data-t src="x.png"></div>', 'violation'],
    ['<input data-t type="image" src="x.png">', 'inapplicable'],
  ])('%s → %s', (html, expected) => {
    expect(check(imageName, html)).toBe(expected);
  });
});

describe('1.1.1 image-button-name', () => {
  it.each([
    ['<input data-t type="image" src="x.svg">', 'violation'],
    ['<input data-t type="image" src="x.svg" alt="">', 'violation'],
    ['<input data-t type="image" src="x.svg" aria-labelledby="nao-existe">', 'violation'],
    ['<input data-t type="image" src="x.svg" alt="Pesquisar">', 'pass'],
    ['<input data-t type="image" src="x.svg" aria-label="Pesquisar">', 'pass'],
    ['<input data-t type="image" src="x.svg" title="Pesquisar">', 'pass'],
    [
      '<span id="s">Pesquisar</span><input data-t type="image" src="x.svg" aria-labelledby="s">',
      'pass',
    ],
    ['<input data-t type="image" src="x.svg" style="display:none">', 'inapplicable'],
    ['<input data-t type="button" value="x">', 'inapplicable'],
  ])('%s → %s', (html, expected) => {
    expect(check(imageButtonName, html)).toBe(expected);
  });
});

describe('1.1.1 svg-img-name', () => {
  it.each([
    ['<svg data-t role="img" width="10" height="10"><circle r="4"/></svg>', 'violation'],
    [
      '<svg data-t role="img" width="10" height="10"><text>1 círculo</text></svg>',
      'violation',
    ],
    [
      '<svg width="10" height="10"><circle data-t role="graphics-symbol" r="4" cx="5" cy="5"/></svg>',
      'violation',
    ],
    [
      '<svg data-t role="img" width="10" height="10"><title>Círculo</title></svg>',
      'pass',
    ],
    [
      '<svg data-t role="graphics-document" aria-label="Gráfico" width="10" height="10"></svg>',
      'pass',
    ],
    ['<svg data-t width="10" height="10"><circle r="4"/></svg>', 'inapplicable'],
    [
      '<svg data-t role="img" aria-hidden="true" width="10" height="10"></svg>',
      'inapplicable',
    ],
    [
      '<svg width="10" height="10"><circle data-t role="graphics-object" r="4"/></svg>',
      'inapplicable',
    ],
  ])('%s → %s', (html, expected) => {
    expect(check(svgImgName, html)).toBe(expected);
  });
});

describe('4.1.2 button-name', () => {
  it.each([
    ['<button data-t></button>', 'violation'],
    ['<button data-t type="button" value="leia mais"></button>', 'violation'],
    ['<span data-t role="button"></span>', 'violation'],
    ['<button data-t role="none"></button>', 'violation'],
    [
      '<button data-t style="position:absolute;left:-9999px" value="x"></button>',
      'violation',
    ],
    [
      '<button data-t><svg aria-hidden="true" width="10" height="10"></svg></button>',
      'violation',
    ],
    ['<button data-t>Fechar</button>', 'pass'],
    ['<button data-t aria-label="Fechar">×</button>', 'pass'],
    ['<input data-t type="submit" value="Enviar">', 'pass'],
    ['<input data-t type="reset">', 'pass'],
    ['<button data-t disabled>Apagar</button>', 'pass'],
    ['<button data-t><img src="x.png" alt="Fechar"></button>', 'pass'],
    ['<button data-t style="display:none"></button>', 'inapplicable'],
    ['<button data-t role="link">ir</button>', 'inapplicable'],
    ['<button data-t role="none" disabled></button>', 'inapplicable'],
    ['<input data-t type="image" alt="x">', 'inapplicable'],
    ['<div data-t>Clique</div>', 'inapplicable'],
  ])('%s → %s', (html, expected) => {
    expect(check(buttonName, html)).toBe(expected);
  });
});

describe('2.4.4 link-name', () => {
  it.each([
    ['<a data-t href="/"></a>', 'violation'],
    ['<a data-t href="/"><img src="x.png" alt=""></a>', 'violation'],
    ['<a data-t href="/"><img src="x.png" role="presentation"></a>', 'violation'],
    ['<a data-t href="/"><img src="x.png" title=""></a>', 'violation'],
    ['<a data-t href="/"><img src="x.png" aria-labelledby="nada"></a>', 'violation'],
    ['<a data-t href="/" role="none"> </a>', 'violation'],
    ['<a data-t href="/">Início</a>', 'pass'],
    ['<a data-t href="/"><img src="x.png" alt="Início"></a>', 'pass'],
    ['<a data-t href="/"><img src="x.png" title="Início"></a>', 'pass'],
    ['<a data-t href="/" title="Início"><img src="x.png" alt=""></a>', 'pass'],
    ['<a data-t href="/" role="doc-biblioref">ACT</a>', 'pass'],
    ['<div data-t role="link" tabindex="0">WAI</div>', 'pass'],
    [
      '<a data-t href="/"><svg width="5" height="5"><title>Casa</title></svg></a>',
      'pass',
    ],
    ['<a data-t href="/" role="button">x</a>', 'inapplicable'],
    ['<a data-t href="/" style="visibility:hidden">x</a>', 'inapplicable'],
    ['<a data-t>sem href</a>', 'inapplicable'],
  ])('%s → %s', (html, expected) => {
    expect(check(linkName, html)).toBe(expected);
  });

  it('area com e sem alt (mapa de imagem)', () => {
    const root = mount(
      '<img src="x.png" width="100" height="100" alt="Planetas" usemap="#m"><map name="m"><area id="a1" shape="rect" coords="0,0,30,30" href="sol.htm" alt="Sol"><area id="a2" shape="rect" coords="30,0,60,30" href="lua.htm"></map>',
    );
    expect(evaluate(linkName, q(root, '#a1'))?.outcome).toBe('pass');
    expect(evaluate(linkName, q(root, '#a2'))?.outcome).toBe('violation');
  });
});

describe('1.3.1 form-label', () => {
  it.each([
    ['<input data-t>', 'violation'],
    ['<input data-t disabled>', 'violation'],
    ['<input data-t aria-label=" ">', 'violation'],
    [
      '<div id="v"></div><select data-t aria-labelledby="v"><option>a</option></select>',
      'violation',
    ],
    ['<label>Nome <div data-t role="textbox"></div></label>', 'violation'],
    ['<div data-t role="textbox">nome</div>', 'violation'],
    ['<label>Data</label> <input data-t type="date">', 'violation'],
    ['<input data-t type="password">', 'violation'],
    ['<label>Nome <input data-t></label>', 'pass'],
    [
      '<label for="c">País</label><select data-t id="c"><option>a</option></select>',
      'pass',
    ],
    ['<div id="l">País</div><textarea data-t aria-labelledby="l"></textarea>', 'pass'],
    ['<input data-t aria-label="Busca" disabled>', 'pass'],
    ['<input data-t title="Busca">', 'pass'],
    ['<div data-t role="checkbox">Aceito os termos</div>', 'pass'],
    ['<label>Cor <input data-t type="color"></label>', 'pass'],
    ['<input data-t placeholder="Sua busca">', 'recommendation'],
    ['<input data-t type="hidden">', 'inapplicable'],
    ['<input data-t type="submit">', 'inapplicable'],
    ['<input data-t style="display:none">', 'inapplicable'],
    ['<input data-t disabled aria-hidden="true">', 'inapplicable'],
    ['<select data-t role="none" disabled><option>a</option></select>', 'inapplicable'],
    ['<input data-t role="button" value="x">', 'inapplicable'],
  ])('%s → %s', (html, expected) => {
    expect(check(formLabel, html)).toBe(expected);
  });
});
