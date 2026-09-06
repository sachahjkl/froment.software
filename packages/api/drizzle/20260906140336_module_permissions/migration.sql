-- Custom SQL migration file, put your code below! --
INSERT INTO permissions (code) VALUES
  ('bank.read'), ('bank.import'), ('bank.reconcile'),
  ('catalog.read'), ('catalog.manage'),
  ('issuer.read'), ('issuer.update'),
  ('condition.read'), ('condition.manage'), ('payment.read');
--> statement-breakpoint
INSERT INTO role_permissions (role_id, permission_code)
SELECT roles.id, permissions.code FROM roles CROSS JOIN permissions
WHERE roles.name = 'administrator' AND permissions.code IN (
  'bank.read', 'bank.import', 'bank.reconcile', 'catalog.read', 'catalog.manage',
  'issuer.read', 'issuer.update', 'condition.read', 'condition.manage', 'payment.read'
);
