-- Primeiro excluir todos os arquivos do bucket certificados-digitais
DELETE FROM storage.objects WHERE bucket_id = 'certificados-digitais';

-- Depois excluir o bucket
DELETE FROM storage.buckets WHERE id = 'certificados-digitais';