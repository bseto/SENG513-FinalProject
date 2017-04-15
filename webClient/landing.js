var socket = io();

function login() {
	var username = document.getElementById("login-username").value;
	var password = document.getElementById("login-password").value;

	socket.emit('login', {username: username, password: password});	
}

function register() {
	var username = document.getElementById("register-username").value;
	var password = document.getElementById("register-password").value;

	socket.emit('register', {username: username, password: password});		
}

$(function () {
    socket.on('connect', function(data) {
    });
    socket.on('login-result', function(data) {
    	if(data) {
    		window.location.href = "http://localhost:3000/chat";
    	}
    	else {
    		console.log('Login Unsuccessful');
			document.getElementById("login-result").innerHTML = "Login Unsuccessful";
    	}
    });
    socket.on('registration-result', function(data) {
    	if(data) {
    		console.log('Registration Successful');
			document.getElementById("register-result").innerHTML = "Registration Successful";
    	}
    	else {
    		console.log('Registration Unsuccessful');
    		document.getElementById("register-result").innerHTML = "Registration Unsuccessful";
    	}
    })
});