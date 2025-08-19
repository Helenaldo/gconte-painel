-- Inserir dados de exemplo para tributação dos primeiros clientes
-- Primeiro, vamos buscar alguns IDs de clientes para criar tributações de exemplo

DO $$
DECLARE
    client_ids UUID[];
    client_id UUID;
    taxation_types TEXT[] := ARRAY['Simples Nacional', 'Lucro Presumido', 'Lucro Real Anual', 'Lucro Real Trimestral', 'MEI'];
    i INT;
BEGIN
    -- Buscar os primeiros 20 IDs de clientes
    SELECT ARRAY(SELECT id FROM clients LIMIT 20) INTO client_ids;
    
    -- Inserir tributações de exemplo para alguns clientes
    FOR i IN 1..LEAST(array_length(client_ids, 1), 15) LOOP
        client_id := client_ids[i];
        
        -- Inserir tributação ativa para cada cliente
        INSERT INTO taxation (client_id, tipo, data, status, valor, descricao)
        VALUES (
            client_id,
            taxation_types[((i - 1) % array_length(taxation_types, 1)) + 1],
            CURRENT_DATE - INTERVAL '1 month',
            'ativa',
            CASE 
                WHEN i % 5 = 0 THEN 0.08
                WHEN i % 3 = 0 THEN 0.15
                ELSE 0.12
            END,
            'Tributação definida automaticamente pelo sistema'
        );
    END LOOP;
    
    -- Inserir algumas tributações inativas para demonstrar o gráfico
    FOR i IN 16..LEAST(array_length(client_ids, 1), 20) LOOP
        client_id := client_ids[i];
        
        INSERT INTO taxation (client_id, tipo, data, status, valor, descricao)
        VALUES (
            client_id,
            taxation_types[((i - 1) % array_length(taxation_types, 1)) + 1],
            CURRENT_DATE - INTERVAL '6 months',
            'inativa',
            0.10,
            'Tributação anterior (inativa)'
        );
    END LOOP;
END $$;