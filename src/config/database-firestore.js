/**
 * Database Adapter - Firestore with SQLite-like API
 * Provides a SQLite-compatible interface for Firestore operations
 */
'use strict';

const { db, FieldValue } = require('./firestore');

/**
 * Generate a unique ID (Firestore auto-generates, but we need sequential-like IDs for compatibility)
 */
async function getNextId(collectionName) {
  const counterRef = db.collection('_counters').doc(collectionName);
  
  try {
    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(counterRef);
      let newId = 1;
      
      if (doc.exists) {
        newId = (doc.data().value || 0) + 1;
      }
      
      transaction.set(counterRef, { value: newId }, { merge: true });
      return newId;
    });
    
    return result;
  } catch (error) {
    console.error(`Error getting next ID for ${collectionName}:`, error);
    throw error;
  }
}

/**
 * SQLite-like prepare statement wrapper
 */
class Statement {
  constructor(collection, query, params = {}) {
    this.collection = collection;
    this.query = query;
    this.params = params;
    this.isSelect = query.trim().toUpperCase().startsWith('SELECT');
    this.isInsert = query.trim().toUpperCase().startsWith('INSERT');
    this.isUpdate = query.trim().toUpperCase().startsWith('UPDATE');
    this.isDelete = query.trim().toUpperCase().startsWith('DELETE');
  }

  /**
   * Execute and return all results (for SELECT)
   */
  async all(...bindParams) {
    const params = bindParams.length > 0 ? bindParams : Object.values(this.params);
    
    try {
      let firestoreQuery = db.collection(this.collection);
      
      // Apply where clauses from params
      if (params.length > 0 && this.params.where) {
        for (const condition of this.params.where) {
          firestoreQuery = firestoreQuery.where(condition.field, condition.operator, condition.value);
        }
      }
      
      // Apply ordering
      if (this.params.orderBy) {
        for (const order of this.params.orderBy) {
          firestoreQuery = firestoreQuery.orderBy(order.field, order.direction || 'asc');
        }
      }
      
      // Apply limit
      if (this.params.limit) {
        firestoreQuery = firestoreQuery.limit(this.params.limit);
      }
      
      const snapshot = await firestoreQuery.get();
      
      return snapshot.docs.map(doc => ({
        id: parseInt(doc.id) || doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error in Statement.all():', error);
      return [];
    }
  }

  /**
   * Execute and return first result (for SELECT)
   */
  async get(...bindParams) {
    const results = await this.all(...bindParams);
    return results.length > 0 ? results[0] : undefined;
  }

  /**
   * Execute INSERT/UPDATE/DELETE and return result info
   */
  async run(...bindParams) {
    const params = bindParams.length > 0 ? bindParams : this.params;
    
    try {
      if (this.isInsert) {
        const id = await getNextId(this.collection);
        const data = {
          ...params,
          id,
          created_at: new Date().toISOString()
        };
        
        await db.collection(this.collection).doc(String(id)).set(data);
        
        return {
          lastInsertRowid: id,
          changes: 1
        };
      }
      
      if (this.isUpdate) {
        const { id, ...updateData } = params;
        updateData.updated_at = new Date().toISOString();
        
        await db.collection(this.collection).doc(String(id)).update(updateData);
        
        return { changes: 1 };
      }
      
      if (this.isDelete) {
        await db.collection(this.collection).doc(String(params.id)).delete();
        return { changes: 1 };
      }
      
      return { changes: 0 };
    } catch (error) {
      console.error('Error in Statement.run():', error);
      throw error;
    }
  }
}

/**
 * Database wrapper object with SQLite-compatible methods
 */
const database = {
  /**
   * Prepare a SQL-like statement (converts to Firestore operations)
   * For simple operations, this tries to map SQL to Firestore
   */
  prepare(sql) {
    // Extract collection name from SQL
    const collectionMatch = sql.match(/FROM\s+(\w+)|INTO\s+(\w+)|UPDATE\s+(\w+)/i);
    const collection = collectionMatch ? (collectionMatch[1] || collectionMatch[2] || collectionMatch[3]) : '';
    
    return new Statement(collection, sql);
  },

  /**
   * Execute a direct Firestore operation
   * @param {string} collection - Collection name
   * @param {object} options - Query options
   * @returns {Promise<any>}
   */
  async query(collection, options = {}) {
    let query = db.collection(collection);
    
    if (options.where) {
      for (const [field, operator, value] of options.where) {
        query = query.where(field, operator, value);
      }
    }
    
    if (options.orderBy) {
      query = query.orderBy(options.orderBy.field, options.orderBy.direction);
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    if (options.offset) {
      query = query.offset(options.offset);
    }
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  /**
   * Get a single document by ID
   */
  async getById(collection, id) {
    const doc = await db.collection(collection).doc(String(id)).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  /**
   * Insert a document
   */
  async insert(collection, data) {
    const id = await getNextId(collection);
    const docData = {
      ...data,
      id,
      created_at: data.created_at || new Date().toISOString()
    };
    
    await db.collection(collection).doc(String(id)).set(docData);
    return id;
  },

  /**
   * Update a document
   */
  async update(collection, id, data) {
    const updateData = {
      ...data,
      updated_at: new Date().toISOString()
    };
    
    await db.collection(collection).doc(String(id)).update(updateData);
    return true;
  },

  /**
   * Delete a document
   */
  async delete(collection, id) {
    await db.collection(collection).doc(String(id)).delete();
    return true;
  },

  /**
   * Execute a transaction
   */
  async transaction(callback) {
    return await db.runTransaction(callback);
  },

  /**
   * Pragma methods (no-op for Firestore compatibility)
   */
  pragma() {
    return this;
  },

  /**
   * Get Firestore instance directly for complex queries
   */
  getFirestore() {
    return db;
  },

  /**
   * Field values
   */
  FieldValue
};

module.exports = database;
