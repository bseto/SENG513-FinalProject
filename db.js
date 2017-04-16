var MongoClient = require('mongodb').MongoClient
var ObjectId = require('mongodb').ObjectID

    , assert = require('assert');

var db_holder;

// Connect to the db
module.exports = {
    testString : function() {
        console.log("Trying to connect to mongodb");
        connectDB(function(db) {
            console.log("We are connected to the Database");
            // db.collection('test').insertOne({
            //     Employeeid: 2,
            //     EmployeeName: "Byrone"
            // });
            var cursor = db.collection('users').find( {} );

            cursor.each(function(err, doc) {

                console.log(doc);

            });
            db.close();
        });
        return "testString!!";
    },
    //Type is either 'user' or 'IT'
    //callbacks true if username is added
    //callbacks false if username is already existing or if there is an error
    insertNewUser : function(username, password, type, color, callback) {
        if (!username || !type || !color){
            console.log("insertNewUser: Not all arguments supplied");
            callback(false);
            return false;
        } else {
            console.log("Inserting: " + username + " " + type + " " + color);
        }
        var available = true;
        connectDB(function(db) {
            checkDuplicate(db, username, function(available){
                if (available === true) {
                    connectDB(function(db) {
                        db.collection('users').insertOne({
                            Username: username,
                            Password: password,
                            Type: type,
                            Color: color
                        }).catch(function (error) {
                            console.log(error);
                        });;
                    });
                    callback(true);
                    return true;
                } else {
                    callback(false);
                    return false;
                }
            });
        });
        return available;
    },
    //If authenticated, will callback with a "doc" with the properties
    //{Username, Password, Type, Color}
    //If not, will callback with false
    authenticateUser : function(username, password, callback) {
        if (!username || !password ){
            console.log("insertNewUser: Not all arguments supplied");
            callback(false);
        }
        connectDB(function(db) {
            authenticate(db, username, password, function(doc){
                if (doc) {
                    console.log("Here is user details. username and password are correct");
                    callback(doc);
                } else {
                    console.log("Wrong username or password");
                    callback(false);
                }
            });
        });
    },
    editUser : function(id, username, type, password, color, callback) {
        if (!id || !username || !type || !password || !color){
            console.log("insertNewUser: Not all arguments supplied");
            callback(false);
            return false;
        }
        console.log(id, username, type, password, color);
        connectDB(function(db) {
            db.collection('users').update({
                _id: new  ObjectId(id)},{
                // _id: id},{
                Username: username,
                Password: password,
                Type: type,
                Color: color
            }, function(err, result){
                if (err){
                    callback(false);
                } else {
                    callback(true);
                }
            });
        });
    }
}

var authenticate = function(db, username, password, callback) {
    var cursor = db.collection('users').find( {Username: username, Password: password} );
    var firstElement = 0;
    cursor.each(function(err, doc) {
        firstElement++;
        if(err) {
            console.log(err);
            console.log("False");
            return callback(false);
        } else {
            if (doc) {
                //If doc exists, it means username and password are correct
                if (firstElement === 1){
                    return callback(doc);
                }
            } else{
                if (firstElement === 1){
                    return callback(false);
                }
            }
        }
    });
}

var checkDuplicate = function(db, username, callback) {
    var cursor = db.collection('users').find( {Username: username} );
    cursor.each(function(err, doc) {
        if(err) {
            console.log(err);
            return callback(false);
        } else {
            if (doc) {
                //If doc exists, it means username exists in the db
                return callback(false);
            } else{
                return callback(true);
            }
        }
    });
}

var connectDB = function(callback) {
    MongoClient.connect("mongodb://localhost:27017/dbstorage", function(err, db) {
        if(!err) {
            ret = callback(db);
            db.close();
            return ret;
        } else {
            console.log("Could not connect to MongoDB");
            return false;
        }
    });

}
