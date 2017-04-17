var socket = io();
var myName = '';
var myID = '';
var myColor = '#000000';
var myRoom = '';

$(function () {
    if ( Cookies.getJSON('profile') ) {
        myName = Cookies.getJSON('profile').username;
        myID = Cookies.getJSON('profile').userid;
        myColor = Cookies.getJSON('profile').color;
    } else {
        window.location.href = "http://localhost:3000/";
    };

    $( "#AccountSettingsBtn" ).button({
        label: "Account Settings"
    }).on("click", function() {
        $("#dialogPane").append(accountSettingsHTML);

        $("#username").attr('placeholder', myName);
        $("#pwd").attr('placeholder', "********");
        $("#color").attr('placeholder', myColor);

        $("#dialogPane").dialog({
            title: "Account Settings",
            autoOpen: false,
            height: 360,
            width: 360,
            modal: true,
            buttons: {
                "Confirm Changes": modifyAccountSettings,
                Cancel: function() {
                    $( this ).dialog('close');
                }
            },
            close: function() {
                $( this ).empty();
                $( this ).dialog('destroy');
            }
        });

        $( "#dialogPane" ).dialog('open');
    });
    $( "#CreateTicketBtn" ).button({
        label: "Create Ticket"
    }).on("click", function() {
        $("#dialogPane").empty();
        $("#dialogPane").append(createTicketHTML);

        $("#dialogPane").dialog({
            title: "Create New Ticket",
            autoOpen: false,
            height: 450,
            width: 360,
            modal: true,
            buttons: {
                "Create a new ticket": onCreateTicketClicked,
                Cancel: function() {
                    $( this ).dialog('close');
                }
            },
            close: function() {
                $( this ).empty();
                $( this ).dialog('destroy');
            }
        });

        $( "#dialogPane" ).dialog('open');
    });   
    $( "#LogoutBtn" ).button({
        label: "Logout"
    }).on("click", function() {
        $("#dialogPane").empty();
        $("#dialogPane").append('<p>Are you sure you want to logout?</p>');
        $("#dialogPane").dialog({
            title: "Logout?",
            resizeable: false,
            height: "auto",
            width: 400,
            modal: true,
            buttons: {
                "Logout": function() {
                    Cookies.remove('profile');
                    $( this ).dialog('close');
                    window.location.href = "http://localhost:3000";
                },
                Cancel: function() {
                    $( this ).dialog('close');
                }
            },
            close: function() {
                $( this ).empty();
                $( this ).dialog('destroy');
            }
        });
        
        $( "#dialogPane" ).dialog('open');
    });

    arrangeButtons = function() {
        let radius = 200;
        let fields = $('.field'), container = $('#buttonPanel'),
            width = container.width(), height = container.height(),
            angle = -0.5*Math.PI, step = (2*Math.PI) / fields.length;
        fields.each(function() {
            let x = Math.round(width/2 + radius * Math.cos(angle) - $(this).width()/2);
            let y = Math.round(height/2 + radius * Math.sin(angle) - $(this).height()/2);
            $(this).css({
                left: x + 'px',
                top: y + 'px'
            });
            angle += step;
        });
    }();

    onCreateTicketClicked = function() {
        $("#ticketName").removeClass( "ui-state-error" );

        let title = $("#ticketName").val();
        let description = $("#description").val();

        if ( title.length < 5 ) {
            $("#ticketName").addClass( "ui-state-error" );
            $(".validateTips").text("Your title must be at least 5 characters long").addClass( "ui-state-highlight" );
            setTimeout(function() {
                $(".validateTips").removeClass( "ui-state-highlight", 1500 );
            }, 250 );
            return false;
        }

        $("#confirmDialog").append('<p>Are you sure you want to submit this ticket?</p>');
        $("#confirmDialog").dialog({
            resizeable: false,
            height: "auto",
            width: 400,
            modal: true,
            buttons: {
                "Submit": function() {
                    $( this ).dialog('close');
                    createTicket( title, description );
                },
                Cancel: function() {
                    $("#confirmDialog").empty();
                    $( this ).dialog('close');
                }
            },
            close: function() {
                $( this ).empty();
                $( this ).dialog('destroy');
            }
        });

    };

    createTicket = function( title, description ) {
        console.log("Creating new ticket...");

        socket.emit('submitTicket', {
            title: title,
            description: description
        });

        $("#dialogPane").dialog('close');
        $("#dialogPane").append(chatHTML);

        $("#textField").keyup(function (e) {
            if (e.keyCode == 13) {	
                sendMessage();
            }
        });

        $( "#dialogPane" ).dialog({
            title: "Live Chat",
            autoOpen: false,
            height: 660,
            width: 530,
            modal: true,
            buttons: {
                Close: function() {
                    $( this ).dialog('close');
                }
            },
            open: function() {
                socket.emit("createChatroom", Cookies.getJSON('profile'));
            },
            close: function() {
                socket.emit("leaveChatroom", {
                    username: myName,
                    room: myRoom
                });
                $( this ).empty();
                $( this ).dialog('destroy');
            }
        });

        $( "#dialogPane" ).dialog('open');
    };

    modifyAccountSettings = function() {
        if ( $("#pwd").val().trim().length < 6) {
            $("#pwd").addClass( "ui-state-error" );
            $(".validateTips").text("Your password must be at least 6 characters.").addClass( "ui-state-highlight" );
            setTimeout(function() {
                $(".validateTips").removeClass( "ui-state-highlight", 1500 );
            }, 250 );
            return false;            
        }

        let newColor = $("#color").val().match(/(^#[0-9a-fA-F]{6})/g);
        if ( !newColor ) {
            $("#color").addClass( "ui-state-error" );
            $(".validateTips").text("Your color selection must be in the form #FFFFFF").addClass( "ui-state-highlight" );
            setTimeout(function() {
                $(".validateTips").removeClass( "ui-state-highlight", 1500 );
            }, 250 );
            return false;   
        }

        socket.emit('updateAccountSettings', {
            userid: myID,
            username: myName,
            type: Cookies.getJSON('profile').type,
            pwd: $("#pwd").val(),
            color: newColor[0]
        });
    };

    socket.on('message', function (data) {
        $('#messageList').append($('<li>').html(buildMessageString(data)));

        if ( $('#messageList').scrollTop() >= ( $('#messageList')[0].scrollHeight - $('#messageList').height() - 100 ) ) {
            $('#messageList').scrollTop($('#messageList')[0].scrollHeight);
        }
    });

    socket.on('serverMessage', function (data) {
        handleServerMessage(data);
    });

    socket.on('connect', function(data) {
        socket.emit('userConnected', Cookies.getJSON('profile'));
    });

    socket.on('update-result', function(result) {
        $("#resultDialog").empty();
        let okfunc = function(){};
        let title = "";
        if ( result ) {
            $("#resultDialog").append('<p>Successfully updated user information.</p>');
            okfunc = function() {
                $("#resultDialog").dialog('close');
                $("#dialogPane").dialog('close');
            }
            title = "Success";
        } else {
            $("#resultDialog").append('<p>Couldn\'t update your information, please try again.</p>');
            okfunc = function() {
                $("#resultDialog").dialog('close');
            }
            title = "Error";
        }

        $("#resultDialog").dialog({
                title: title,
                resizeable: false,
                height: "auto",
                modal: true,
                buttons: {
                    Ok: okfunc
                },
                close: function(){
                    $( this ).empty();
                    $( this ).dialog('destroy');
                }
            });
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
            room: myRoom,
            message: $('#textField').val()
        });
        $('#textField').val('');
    };

    clearChatHistory = function() {
        $('#messageList').empty();
    };

    clearUserList = function() {
        $('#userList').empty();
    };

    handleServerMessage = function (data) {
        let dirty = false;
        if (data.color) {
            myColor = data.color;
            dirty = true;
        }
        if (data.username) {
            myName = data.username;
            dirty = true;
        }
        if (data.newRoom) {
            myRoom = data.newRoom;
        }
        if (data.chatHistory) {
            clearChatHistory();
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
        if ( dirty ) {
            Cookies.set('profile', {
				username: myName,
				userid: Cookies.getJSON('profile').userid,
				type: Cookies.getJSON('profile').type,
				color: myColor
            });
        }
    };

    var accountSettingsHTML = '<div id="dialogContent"><div id="resultDialog"></div><form><fieldset><p class="validateTips">Please enter your info.</p><label for="pwd">Password: </label><input type="password" name="pwd" id="pwd" class="text ui-widget-content ui-corner-all" size="25" maxlength="20"><br><label for="color">Color: </label><br><input type="text" name="color" id="color" class="text ui-widget-content ui-corner-all" size="25" maxlength="7"></br></fieldset></form></div>';

    var createTicketHTML = '<div id="dialogContent"><div id="confirmDialog" title="Confirm"></div><p class="validateTips">You must at least provide a title.</p><form><fieldset><label for="ticketName">Title: </label><input type="text" name="ticketName" id="ticketName" placeholder="A descriptive title..." class="text ui-widget-content ui-corner-all" size="25" maxlength="40"><br><label for="description">Description: </label><br><textarea name="description" id="description" placeholder="Please be concise and clear" cols="35" rows="10" maxlength="600" class="ui-widget-content ui-corner-all"/></fieldset></form></div>';

    var chatHTML = '<div id="dialogContent" style="height: 100%"><div id="chat-content"><div id="messageArea"><ul id="messageList"></ul></div><div id="chat-controls"><textarea id="textField" placeholder="Enter text..."/></div></div></div>';

});
