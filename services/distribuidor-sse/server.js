const express = require('express');
const cors = require('cors');
const { Client } = require('pg');

const app = express();

app.use(cors({ origin: '*' }));

const clients = {};
const chatClients = {};

const pgClient = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function startPostgresListener() {
    try {
        await pgClient.connect();

        console.log('Conectado ao PostgreSQL');

        await pgClient.query('LISTEN fila_alterada');
        await pgClient.query('LISTEN chat_nova_mensagem');

        console.log('Escutando fila_alterada');

        const filaAtualizacao = new Set();

        let timer = null;

        pgClient.on('notification', async (msg) => {

            try {

                if (msg.channel === 'chat_nova_mensagem') {

                    const payload =
                        JSON.parse(msg.payload);

                    const clientes =
                        chatClients[payload.unidade_id];

                    if (!clientes) return;

                    clientes.forEach(res => {

                        res.write(
                            `data: ${JSON.stringify(payload)}\n\n`
                        );

                    });

                    return;

                }

                if (msg.channel !== 'fila_alterada') return

                const payload = JSON.parse(msg.payload);

                filaAtualizacao.add(String(payload.unidade_id));

                if (timer) return;

                timer = setTimeout(async () => {

                    const unidades = [...filaAtualizacao];

                    filaAtualizacao.clear();
                    timer = null;

                    for (const unidadeId of unidades) {

                        const clientesUnidade = clients[unidadeId];

                        if (!clientesUnidade?.length) continue;

                        try {

                            // ==========================
                            // RECEPÇÃO
                            // ==========================

                            const possuiRecepcao =
                                clientesUnidade.some(
                                    c => c.tipo === 'recepcao'
                                );

                            const possuiPainelTV =
                                clientesUnidade.some(
                                    c => c.tipo === 'painel_tv'
                                );

                            let dadosRecepcao = null;

                            let dadosPainelTV = null;

                            if (possuiPainelTV) {

                                const result =
                                    await pgClient.query(
                                        `
                                        select *
                                        from get_painel_tv_fila($1)
                                        `,
                                        [unidadeId]
                                    );

                                dadosPainelTV = result.rows;
                            }

                            if (possuiRecepcao) {

                                const result =
                                    await pgClient.query(
                                        `
                                        select *
                                        from get_painel_recepcao_novo($1)
                                        `,
                                        [unidadeId]
                                    );

                                dadosRecepcao = result.rows;
                            }

                            // ==========================
                            // ESPECIALIDADES
                            // ==========================

                            const salasAtivas =
                                [
                                    ...new Set(
                                        clientesUnidade
                                            .filter(
                                                c =>
                                                    c.tipo === 'especialidade'
                                            )
                                            .map(c => c.sala)
                                    )
                                ];

                            const cacheEspecialidades = {};

                            for (const sala of salasAtivas) {

                                const result =
                                    await pgClient.query(
                                        `
                                        select *
                                        from get_fila_especialidade_novo(
                                            $1,
                                            $2
                                        )
                                        `,
                                        [
                                            sala,
                                            unidadeId
                                        ]
                                    );

                                cacheEspecialidades[sala] =
                                    result.rows;
                            }

                            // ==========================
                            // ENVIO
                            // ==========================

                            clientesUnidade.forEach(cliente => {

                                try {

                                    if (
                                        cliente.tipo === 'recepcao'
                                    ) {

                                        cliente.res.write(
                                            `data: ${JSON.stringify({
                                                tipo: 'recepcao',
                                                dados: dadosRecepcao
                                            })}\n\n`
                                        );

                                        return;
                                    }

                                    if (
                                        cliente.tipo === 'painel_tv'
                                    ) {

                                        cliente.res.write(
                                            `data: ${JSON.stringify({
                                                tipo: 'painel_tv',
                                                dados: dadosPainelTV
                                            })}\n\n`
                                        );

                                        return;
                                    }

                                    if (
                                        cliente.tipo ===
                                        'especialidade'
                                    ) {

                                        cliente.res.write(
                                            `data: ${JSON.stringify({
                                                tipo: 'especialidade',
                                                dados:
                                                    cacheEspecialidades[
                                                    cliente.sala
                                                    ] || []
                                            })}\n\n`
                                        );

                                    }

                                } catch (err) {

                                    console.error(
                                        'Erro envio cliente',
                                        err
                                    );

                                }

                            });

                        } catch (err) {

                            console.error(
                                'Erro processando unidade',
                                unidadeId,
                                err
                            );

                        }

                    }

                }, 500);

            } catch (err) {

                console.error(
                    'Erro processando NOTIFY',
                    err
                );

            }

        });

        setInterval(() => {

            Object.values(clients).forEach(lista => {

                lista.forEach(cliente => {

                    try {
                        cliente.res.write(': ping\n\n');
                    } catch { }

                });

            });

        }, 30000);

        setInterval(() => {

            Object.values(chatClients)
                .forEach(lista => {

                    lista.forEach(res => {

                        try {

                            res.write(': ping\n\n');

                        } catch { }

                    });

                });

        }, 30000);

        pgClient.on('error', (err) => {

            console.error(
                'Erro PostgreSQL:',
                err
            );

        });

    } catch (err) {

        console.error(
            'Erro ao conectar PostgreSQL:',
            err
        );

    }

}

startPostgresListener();

async function enviarCargaInicial(
    pgClient,
    res,
    tipo,
    unidadeId,
    sala
) {

    try {

        if (tipo === 'recepcao') {

            const result =
                await pgClient.query(
                    `
                    select *
                    from get_painel_recepcao_novo($1)
                    `,
                    [unidadeId]
                );

            res.write(
                `data: ${JSON.stringify({
                    tipo: 'recepcao',
                    dados: result.rows
                })}\n\n`
            );

            return;
        }

        if (tipo === 'especialidade') {

            const result =
                await pgClient.query(
                    `
                    select *
                    from get_fila_especialidade_novo(
                        $1,
                        $2
                    )
                    `,
                    [
                        sala,
                        unidadeId
                    ]
                );

            res.write(
                `data: ${JSON.stringify({
                    tipo: 'especialidade',
                    dados: result.rows
                })}\n\n`
            );

            return;
        }

        if (tipo === 'painel_tv') {

            const result =
                await pgClient.query(
                    `
                    select *
                    from get_painel_tv_fila($1)
                    `,
                    [unidadeId]
                );

            res.write(
                `data: ${JSON.stringify({
                    tipo: 'painel_tv',
                    dados: result.rows
                })}\n\n`
            );

            return;
        }

    } catch (err) {

        console.error(
            'Erro carga inicial:',
            err
        );

    }

}

app.get('/', (req, res) => {
    res.send('OK');
});

app.get('/stream-fila', async (req, res) => {

    const unidadeId =
        String(req.query.unidadeId || '');

    const tipo =
        String(req.query.tipo || '');

    const sala =
        String(req.query.sala || '');

    if (!unidadeId) {

        return res
            .status(400)
            .send('Falta unidadeId');

    }

    if (!tipo) {

        return res
            .status(400)
            .send('Falta tipo');

    }

    res.setHeader(
        'Content-Type',
        'text/event-stream'
    );

    res.setHeader(
        'Cache-Control',
        'no-cache'
    );

    res.setHeader(
        'Connection',
        'keep-alive'
    );

    res.flushHeaders?.();
    res.write(': connected\n\n');

    if (!clients[unidadeId]) {

        clients[unidadeId] = [];

    }

    const cliente = {
        res,
        tipo,
        sala
    };

    await enviarCargaInicial(
        pgClient,
        res,
        tipo,
        unidadeId,
        sala
    );

    clients[unidadeId].push(cliente);

    console.log(
        'Cliente conectado:',
        unidadeId,
        tipo,
        sala
    );

    req.on('close', () => {

        clients[unidadeId] =
            clients[unidadeId]
                .filter(c => c !== cliente);

        if (
            clients[unidadeId].length === 0
        ) {

            delete clients[unidadeId];

        }

        console.log(
            'Cliente desconectado:',
            unidadeId,
            tipo,
            sala
        );

    });

});

app.get('/stream-chat', (req, res) => {

    const unidadeId =
        String(req.query.unidadeId);

    res.setHeader(
        'Content-Type',
        'text/event-stream'
    );

    res.setHeader(
        'Cache-Control',
        'no-cache'
    );

    res.setHeader(
        'Connection',
        'keep-alive'
    );

    res.flushHeaders?.();
    res.write(': connected\n\n');

    if (!chatClients[unidadeId]) {
        chatClients[unidadeId] = [];
    }

    chatClients[unidadeId].push(res);

    req.on('close', () => {

        chatClients[unidadeId] =
            chatClients[unidadeId]
                .filter(r => r !== res);

    });

});

const PORT =
    process.env.PORT || 8765;

app.listen(
    PORT,
    '0.0.0.0',
    () => {

        console.log(
            `SSE rodando na porta ${PORT}`
        );

    }
);
