# -*- coding: utf-8 -*-
"""Conversor Amor Explosivo -> GEP V1 (Grafo de Experiência do Programa).
Infraestrutura escrita pelo Claude (15/11/2026). O conteúdo vem do uso do jogo ou do robô de cenários.

O jogo roda no navegador e exporta a experiência nova (botão EXPORTAR EXPERIÊNCIA na pausa, ou o robô
`node _grafo_robo.js`). Este conversor grava esse arquivo com o gep.py OFICIAL no arquivo único do programa
e passa pelo validador do contrato.

Uso:  python gep_amor_explosivo.py <experiencia.json> [mais.json ...] [--destino E:\\NERAEL_GEP\\amor_explosivo.gep.sqlite]
Cada exportação tem um id: importar o mesmo arquivo duas vezes NÃO conta em dobro.
"""
import json
import subprocess
import sys
import time
from pathlib import Path

CONTRATO = Path(r'C:\Users\Douglas\Downloads\ARCH-NEURAL 3D-MNLS v3\FORJA\CONTRATO_GRAFO_PROGRAMAS')
sys.path.insert(0, str(CONTRATO))
from gep import GEP, _slug  # noqa: E402

DESTINO_PADRAO = r'E:\NERAEL_GEP\amor_explosivo.gep.sqlite'
VERSAO_JOGO = 'v27'
# tipos do jogo -> tipos de nó do contrato
TIPO_NO = {'fase': 'estado', 'tipo_fase': 'conceito', 'sala': 'entidade', 'modo': 'conceito', 'regra': 'regra',
           'monstro': 'entidade', 'poder_disponivel': 'acao', 'poder': 'acao', 'evento': 'estado', 'causa': 'acao',
           'fonte': 'entidade', 'triste': 'entidade', 'forca': 'padrao', 'coracao': 'entidade'}
# relações do jogo -> tipos de aresta do contrato
TIPO_ARESTA = {'causa': 'causa', 'leva_a': 'antes_de', 'coativacao': 'coativacao'}
TEXTO_TIPO = {'fase': 'fase', 'tipo_fase': 'tipo de fase', 'sala': 'sala', 'modo': 'modo de jogo', 'regra': 'regra da sala',
              'monstro': 'monstro', 'poder_disponivel': 'poder disponível', 'poder': 'poder usado', 'evento': 'acontecimento',
              'causa': 'causa de apaixonar', 'fonte': 'fonte de dano', 'triste': 'tipo de triste', 'forca': 'força da explosão',
              'coracao': 'coração da coleta'}


def nome_gep(id_jogo):
    tipo, _, rot = id_jogo.partition(':')
    return f'{_slug(tipo)}__{_slug(rot)}'[:120]


def importar(g, dados):
    origem = dados.get('origem') if dados.get('origem') in ('uso_programa', 'simulacao_propria') else 'uso_programa'
    exp_id = str(dados.get('id_exportacao') or '')
    if not exp_id:
        raise ValueError('arquivo sem id_exportacao (não veio do jogo v27)')
    if g.con.execute('SELECT 1 FROM gep_meta WHERE chave=?', ('importado:' + exp_id,)).fetchone():
        return {'ignorado': exp_id, 'motivo': 'já importado antes'}
    mapa = {}

    def garantir(id_jogo, info=None):
        if id_jogo in mapa:
            return mapa[id_jogo]
        tipo, _, rot = id_jogo.partition(':')
        texto = f'{TEXTO_TIPO.get(tipo, tipo)}: {rot}'[:600]
        nid = g.no(nome_gep(id_jogo), texto, tipo=TIPO_NO.get(tipo, 'conceito'), camada=tipo,
                   fatos={'id_no_jogo': id_jogo, 'vezes_no_jogo': (info or {}).get('n', 0)}, origem=origem)
        mapa[id_jogo] = nid
        return nid

    for x in dados.get('nos', []):
        nid = garantir(x['id'], x)
        for var, s in (x.get('variaveis') or {}).items():
            g.variavel(f'{nome_gep(x["id"])}__{_slug(var)}'[:110], s.get('ultimo'), minimo=s.get('min'), maximo=s.get('max'),
                       unidade='s' if 'segundos' in var else '', de=nid, origem=origem)
    agora = time.strftime('%Y-%m-%d %H:%M:%S')
    n_ar = 0
    for a in dados.get('arestas', []):
        de, para = garantir(a['de']), garantir(a['para'])
        if de == para:      # nó ligado a ele mesmo não ensina nada (o validador avisa); pula
            continue
        eid = g.aresta(de, para, TIPO_ARESTA.get(a.get('rel'), 'coativacao'), float(a.get('peso', 0.1)),
                       fatos={'rel_no_jogo': a.get('rel')}, origem=origem)
        # frequência de uso: soma o que é NOVO desde a última exportação (nunca apaga; o peso segue o aprendido no jogo)
        g.con.execute('UPDATE gep_arestas SET usos=usos+?, sucessos=sucessos+?, falhas=falhas+?, energia=energia+?, '
                      'peso=?, ultimo_uso=? WHERE id=?',
                      (int(a.get('usos', 0)), int(a.get('sucessos', 0)), int(a.get('falhas', 0)),
                       0.1 * int(a.get('sucessos', 0)), float(a.get('peso', 0.1)), agora, eid))
        n_ar += 1
    n_ep = 0
    for ep in dados.get('episodios', []):
        nos_ep = [garantir(i) for i in ep.get('nos', [])]
        eorig = ep.get('origem') if ep.get('origem') in ('uso_programa', 'simulacao_propria') else origem
        e = g.episodio(entrada=ep.get('entrada', ''), nos=nos_ep, origem=eorig)
        g.feedback(e, float(ep.get('nota', 0.4)), texto=f"resultado: {ep.get('resultado')}", origem=eorig)
        n_ep += 1
    g.con.execute('INSERT OR REPLACE INTO gep_meta VALUES(?,?)', ('importado:' + exp_id, agora))
    return {'importado': exp_id, 'origem': origem, 'nos': len(dados.get('nos', [])), 'arestas': n_ar, 'episodios': n_ep}


def main():
    args = sys.argv[1:]
    destino = DESTINO_PADRAO
    if '--destino' in args:
        i = args.index('--destino'); destino = args[i + 1]; del args[i:i + 2]
    if not args:
        print(__doc__); sys.exit(2)
    g = GEP('amor_explosivo', destino, versao_programa=VERSAO_JOGO, autor='amor_explosivo')
    for arq in args:
        # lote oficial do gep.py: uma transação por arquivo (um commit no fim; se der erro no meio, nada fica pela metade)
        with g.lote():
            res = importar(g, json.loads(Path(arq).read_text(encoding='utf-8')))
        print(json.dumps(res, ensure_ascii=False))
    g.fechar()
    r = subprocess.run([sys.executable, str(CONTRATO / 'validar_gep.py'), destino], capture_output=True, text=True, encoding='utf-8')
    print(r.stdout.strip()); sys.exit(r.returncode)


if __name__ == '__main__':
    main()
