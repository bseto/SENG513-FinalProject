var socket = io();
var myName = "";
var myColor = '#000000';

$(function () {
	if ( Cookies.getJSON('profile') ) {
		myName = Cookies.getJSON('profile').username;
		myColor = Cookies.getJSON('profile').color;
	}
	
	socket.on('connect', function(data) {
		socket.emit('connectRequest', Cookies.getJSON('profile') );
	});
	
	socket.on('message', function (data) {
		$('#messageList').append($('<li>').html(buildMessageString(data)));
		
		if ( $('#messageList').scrollTop() >= ( $('#messageList')[0].scrollHeight - $('#messageList').height() - 100 ) ) {
			$('#messageList').scrollTop($('#messageList')[0].scrollHeight);
		}
	});

	socket.on('serverMessage', function (data) {
		handleServerMessage(data);
	});
	
	$("#textField").keyup(function (e) {
		if (e.keyCode == 13) {	
			sendMessage();
		}
	});

	buildMessageString = function (data) {
		let string = '';
		if (data.userId === socket.id || data.username == myName)
			string = '<b>[' + data.timestamp + '] <font color="' + data.color + '">' + data.username + "</font>: " + data.message + '</b>';
		else
			string = '<b>[' + data.timestamp + '] <font color="' + data.color + '">' + data.username + "</font>: </b>" + data.message;
		
		return string;
	};

	sendMessage = function () {
		socket.emit('message', {
			username: myName,
			userId: socket.id,
			color: myColor,
			message: $('#textField').val()
		});
		$('#textField').val('');
	};

	handleServerMessage = function (data) {
		if (data.color) {
			myColor = data.color;
		}		
		if (data.username) {
			myName = data.username;
		}
		if (data.userList) {
			$('#userList').empty();
			for ( let user of data.userList ) {
				$('#userList').append($('<li>').html('<b><font color="' + user.color + '">' + user.username + '</font></b>'));
			}
		}
		if (data.chatHistory) {
			for ( let entry of data.chatHistory ) {
				if ( entry.serverMessage ) {
					entry.username = 'Server';
					entry.color = "red";
					$('#messageList').append($('<li>').css('color', "red").html(buildMessageString(entry)));
				} else {
					$('#messageList').append($('<li>').html(buildMessageString(entry)));
				}
			}
			$('#messageList').scrollTop($('#messageList')[0].scrollHeight);
		}
		if (data.message) {
			data.username = 'Server';
			data.color = "red";
			$('#messageList').append($('<li>').css('color', "red").html(buildMessageString(data)));
			
			if ( $('#messageList').scrollTop() >= ( $('#messageList')[0].scrollHeight - $('#messageList').height() - 100 ) ) {
				$('#messageList').scrollTop($('#messageList')[0].scrollHeight);
			}
		}
		Cookies.set('profile', {
			username: myName,
			color: myColor
		});
	};
});
