var MongoClient = require('mongodb').MongoClient
 , assert = require('assert');

var db_holder;

// Connect to the db
module.exports = {
    testString : function() {
        console.log("Trying to connect to mongodb");
        MongoClient.connect("mongodb://localhost:27017/dbstorage", function(err, db) {
            if(!err) {
                console.log("We are connected to the Database");
                // db.collection('test').insertOne({
                //     Employeeid: 2,
                //     EmployeeName: "Byrone"
                // });
                var cursor = db.collection('test').find( {Employeeid: 2} );

                cursor.each(function(err, doc) {

                    console.log(doc);

                });
                db.close();
            } else {
                console.log("Could not connect to MongoDB");
            }
        });
        return "testString!!";
    },
};

