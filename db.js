var MongoClient = require('mongodb').MongoClient
 , assert = require('assert');

// Connect to the db
module.exports = {
    testString : function() {
        console.log("Trying to connect to mongodb");
        MongoClient.connect("mongodb://localhost:27017/dbstorage", function(err, db) {
            if(!err) {
                console.log("We are connected to the Database");
                insertDocuments(db, function() {
                    db.close();
                });
            } else {
                console.log("Could not connect to MongoDB");
            }
        });
        return "testString!!";
    }
};

var insertDocuments = function(db, callback) {
    // Get the documents collection
    var collection = db.collection('documents');
    // Insert some documents
    collection.insertMany([
        {a : 1}, {a : 2}, {a : 3}
    ], function(err, result) {
        assert.equal(err, null);
        assert.equal(3, result.result.n);
        assert.equal(3, result.ops.length);
        console.log("Inserted 3 documents into the document collection");
        callback(result);
    });

}
