// SQL generation utilities for database import

import { PostgresType, ColumnTypeInfo } from './typeInference';

export interface ColumnDefinition {
  name: string;
  type: PostgresType;
  nullable: boolean;
  isPrimaryKey: boolean;
  isUnique: boolean;
  defaultValue?: string;
  references?: {
    table: string;
    column: string;
  };
}

export interface IndexDefinition {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface TableDefinition {
  name: string;
  schema: string;
  columns: ColumnDefinition[];
  indexes: IndexDefinition[];
}

export interface SQLStatement {
  type: 'CREATE_TABLE' | 'ALTER_TABLE' | 'CREATE_INDEX' | 'INSERT' | 'DROP_TABLE';
  sql: string;
  description: string;
  sequence: number;
}

/**
 * Sanitize a table name for PostgreSQL
 */
export function sanitizeTableName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^(\d)/, '_$1')
    .toLowerCase()
    .substring(0, 63);
}

/**
 * Sanitize a column name for PostgreSQL
 */
export function sanitizeColumnName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^(\d)/, '_$1')
    .toLowerCase()
    .substring(0, 63);
}

/**
 * Generate CREATE TABLE SQL statement
 */
export function generateCreateTableSQL(
  tableDef: TableDefinition
): SQLStatement {
  const { name, schema, columns } = tableDef;
  const sanitizedName = sanitizeTableName(name);
  const fullTableName = schema ? `"${schema}"."${sanitizedName}"` : `"${sanitizedName}"`;

  const columnDefs = columns.map(col => {
    const parts = [`  "${sanitizeColumnName(col.name)}"`, col.type];

    if (col.isPrimaryKey) {
      parts.push('PRIMARY KEY');
    } else {
      if (!col.nullable) {
        parts.push('NOT NULL');
      }
      if (col.isUnique) {
        parts.push('UNIQUE');
      }
    }

    if (col.defaultValue !== undefined) {
      parts.push(`DEFAULT ${col.defaultValue}`);
    }

    if (col.references) {
      parts.push(`REFERENCES "${col.references.table}"("${col.references.column}")`);
    }

    return parts.join(' ');
  });

  const sql = `CREATE TABLE IF NOT EXISTS ${fullTableName} (\n${columnDefs.join(',\n')}\n);`;

  return {
    type: 'CREATE_TABLE',
    sql,
    description: `Create table ${sanitizedName}`,
    sequence: 0
  };
}

/**
 * Generate CREATE INDEX SQL statements
 */
export function generateIndexSQL(
  tableName: string,
  schema: string,
  indexes: IndexDefinition[]
): SQLStatement[] {
  const sanitizedTable = sanitizeTableName(tableName);
  const fullTableName = schema ? `"${schema}"."${sanitizedTable}"` : `"${sanitizedTable}"`;

  return indexes.map((index, i) => {
    const indexName = `idx_${sanitizedTable}_${index.columns.map(sanitizeColumnName).join('_')}`;
    const uniqueKeyword = index.unique ? 'UNIQUE ' : '';
    const columnList = index.columns.map(c => `"${sanitizeColumnName(c)}"`).join(', ');
    
    const sql = `CREATE ${uniqueKeyword}INDEX IF NOT EXISTS "${indexName}" ON ${fullTableName} (${columnList});`;

    return {
      type: 'CREATE_INDEX' as const,
      sql,
      description: `Create ${index.unique ? 'unique ' : ''}index on ${index.columns.join(', ')}`,
      sequence: i + 1
    };
  });
}

/**
 * Generate batch INSERT SQL statements
 */
export function generateInsertBatchSQL(
  tableName: string,
  schema: string,
  columns: string[],
  rows: any[][],
  batchSize: number = 50
): SQLStatement[] {
  const sanitizedTable = sanitizeTableName(tableName);
  const fullTableName = schema ? `"${schema}"."${sanitizedTable}"` : `"${sanitizedTable}"`;
  const columnList = columns.map(c => `"${sanitizeColumnName(c)}"`).join(', ');
  
  const statements: SQLStatement[] = [];
  const totalBatches = Math.ceil(rows.length / batchSize);

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    
    const valueRows = batch.map(row => {
      const values = row.map(val => formatSQLValue(val));
      return `(${values.join(', ')})`;
    });

    const sql = `INSERT INTO ${fullTableName} (${columnList})\nVALUES\n${valueRows.join(',\n')};`;

    statements.push({
      type: 'INSERT',
      sql,
      description: `Insert rows ${i + 1}-${Math.min(i + batchSize, rows.length)} of ${rows.length} (batch ${batchNum}/${totalBatches})`,
      sequence: batchNum
    });
  }

  return statements;
}

/**
 * Format a value for SQL insertion
 */
function formatSQLValue(value: any): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }

  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) {
      return 'NULL';
    }
    return String(value);
  }

  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }

  if (typeof value === 'object') {
    return `'${escapeSQLString(JSON.stringify(value))}'::jsonb`;
  }

  // String value - escape single quotes
  return `'${escapeSQLString(String(value))}'`;
}

/**
 * Escape single quotes in SQL strings
 */
function escapeSQLString(str: string): string {
  return str.replace(/'/g, "''");
}

/**
 * Generate complete migration script for a new table with data
 */
export function generateFullImportSQL(
  tableDef: TableDefinition,
  rows: any[][],
  batchSize: number = 50
): SQLStatement[] {
  const statements: SQLStatement[] = [];
  let sequence = 0;

  // Create table
  const createTable = generateCreateTableSQL(tableDef);
  createTable.sequence = sequence++;
  statements.push(createTable);

  // Create indexes
  const indexStatements = generateIndexSQL(tableDef.name, tableDef.schema, tableDef.indexes);
  indexStatements.forEach(stmt => {
    stmt.sequence = sequence++;
    statements.push(stmt);
  });

  // Identify columns that should receive data (exclude auto-generated columns)
  const columnsWithData: { name: string; index: number }[] = [];
  tableDef.columns.forEach((col, originalIndex) => {
    // Skip auto-generated primary key columns (have defaultValue like gen_random_uuid())
    if (col.isPrimaryKey && col.defaultValue) {
      return;
    }
    columnsWithData.push({ name: col.name, index: originalIndex });
  });

  // For each row, extract only the values for columns that need data
  // The data rows correspond to the SOURCE data, not the table columns
  // If there's an auto-ID, the first column in tableDef is 'id' but the rows don't have it
  const hasAutoId = tableDef.columns[0]?.isPrimaryKey && tableDef.columns[0]?.defaultValue;
  
  const columnNames = columnsWithData.map(c => c.name);
  
  // Map the row data correctly - if there's an auto-ID, rows don't include it
  const mappedRows = rows.map(row => {
    if (hasAutoId) {
      // Rows correspond to source columns (after the auto-ID column in tableDef)
      // Just return the row as-is since it matches the non-auto columns
      return row;
    } else {
      // No auto-ID, extract columns based on their indices
      return columnsWithData.map(c => row[c.index]);
    }
  });
  
  const insertStatements = generateInsertBatchSQL(
    tableDef.name,
    tableDef.schema,
    columnNames,
    mappedRows,
    batchSize
  );
  insertStatements.forEach(stmt => {
    stmt.sequence = sequence++;
    statements.push(stmt);
  });

  return statements;
}

/**
 * Generate table definition from inferred column types
 * Handles duplicate column names by appending suffixes
 */
export function generateTableDefinitionFromInference(
  tableName: string,
  schema: string,
  columnInfos: ColumnTypeInfo[],
  addIdColumn: boolean = true
): TableDefinition {
  const columns: ColumnDefinition[] = [];
  const indexes: IndexDefinition[] = [];
  const usedNames = new Set<string>();

  // Add auto-generated ID if requested
  if (addIdColumn) {
    columns.push({
      name: 'id',
      type: 'UUID',
      nullable: false,
      isPrimaryKey: true,
      isUnique: true,
      defaultValue: 'gen_random_uuid()'
    });
    usedNames.add('id');
  }

  // Add inferred columns
  columnInfos.forEach(info => {
    // Skip internal columns
    if (info.name.startsWith('_')) return;

    // Handle duplicate column names
    let finalName = info.name;
    
    // If auto-ID is enabled and column is named 'id', rename it
    if (addIdColumn && finalName.toLowerCase() === 'id') {
      finalName = 'original_id';
    }
    
    // Ensure no duplicate column names
    if (usedNames.has(finalName.toLowerCase())) {
      let suffix = 2;
      while (usedNames.has(`${finalName}_${suffix}`.toLowerCase())) {
        suffix++;
      }
      finalName = `${finalName}_${suffix}`;
    }
    usedNames.add(finalName.toLowerCase());

    columns.push({
      name: finalName,
      type: info.inferredType,
      nullable: info.nullable,
      isPrimaryKey: !addIdColumn && info.suggestPrimaryKey,
      isUnique: !info.suggestPrimaryKey && info.uniqueRatio > 0.99
    });

    // Add index if suggested
    if (info.suggestIndex) {
      indexes.push({
        name: `idx_${tableName}_${finalName}`,
        columns: [finalName],
        unique: false
      });
    }
  });

  return {
    name: tableName,
    schema,
    columns,
    indexes
  };
}

/**
 * Calculate optimal batch size based on column count and row count
 */
export function calculateBatchSize(columnCount: number, totalRows: number): number {
  // Estimate bytes per row (rough estimate: 50 bytes per column average)
  const estimatedRowSize = columnCount * 50;
  
  // Target batch size around 100KB
  const targetBatchBytes = 100 * 1024;
  
  let batchSize = Math.floor(targetBatchBytes / estimatedRowSize);
  
  // Clamp between 10 and 100
  batchSize = Math.max(10, Math.min(100, batchSize));
  
  // For very small datasets, use smaller batches
  if (totalRows < 100) {
    batchSize = Math.min(batchSize, Math.ceil(totalRows / 5));
  }
  
  return Math.max(10, batchSize);
}

/**
 * Generate DROP TABLE statement
 */
export function generateDropTableSQL(tableName: string, schema: string): SQLStatement {
  const sanitizedTable = sanitizeTableName(tableName);
  const fullTableName = schema ? `"${schema}"."${sanitizedTable}"` : `"${sanitizedTable}"`;
  
  return {
    type: 'DROP_TABLE',
    sql: `DROP TABLE IF EXISTS ${fullTableName} CASCADE;`,
    description: `Drop table ${sanitizedTable}`,
    sequence: 0
  };
}
