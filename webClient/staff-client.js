var socket = io();
var myName = "";
var myColor = '#000000';
var myNamespace = "";

$(function () {
    var tabTitle = $("#tab_title"), tabContent = $( "#tab_content" ),
    tabTemplate = "<li><a href='#{href}'>#{tabLabel}</a> <span class='ui-icon ui-icon-close'>Remove Tab</span></li>",
    tabCounter = 1, tabsOpen = 0, tabIndex = 0;
    
    var tabs = $("#tabs").tabs();
    
    // adding tabs functionality
    function addTab() {
        var label = tabTitle.val() || "Tab " + tabCounter,
            id = "tab-" + tabCounter,
            li = $( tabTemplate.replace( /#\{href\}/g, "#" + id ).replace( /#\{tabLabel\}/g, label ) ),
            tabContentHtml = '<div id="chatArea"><div id="messageArea"><ul id="messageList"></ul></div><div id="buttonsArea"><div id="buttons" style="display: table; margin-top: 10px; height: 100%;"><ul style="width: 80%; height: 45%; display: table-cell;"><li style="margin-top: 10%;"><button id="user_history" class="button" style="font-size: 14px; padding: 12px 20px; width: 85%;">User History</button></li><li style="margin-top: 23%;"><button id="invite_others" class="button" style="font-size: 14px; padding: 12px 20px; width: 85%;">Invite Others</button></li><li style="margin-top: 23%;"><button id="resolve_ticket" class="button" style="font-size: 14px; padding: 12px 20px; width: 85%;">Resolve Ticket</button></li></ul></div></div><div id="controls"><textarea id="textField" placeholder="Enter text..."></textarea></div></div>';
            tabs.find( ".ui-tabs-nav" ).append( li );
            tabs.append( "<div id='" + id + "' style=\"padding-top: 0px; padding-bottom: 0px;\"><p>" + tabContentHtml + "</p></div>" );
            tabs.tabs( "refresh" );
            tabCounter++;            
    }
    
    function newTab() {
        if (tabsOpen < 5){
            addTab();
            $("#tabs").tabs("option", "active", tabIndex); // set most recent as active tab
            tabsOpen++; // max tabs tracker
            tabIndex++; // active tabs tracker
        } else {
            $( function() {
                $( "#dialogTabs" ).dialog({modal: true});
            } );
        }
    }
    
    // close tab using UI icon
    $("#tabs").delegate( "span.ui-icon-close", "click", function() {
        var panelId = $( this ).closest( "li" ).remove().attr( "aria-controls" );
        $( "#" + panelId ).remove();
        tabsOpen--; // max tabs tracker
        tabIndex--; // active tabs tracker
        $("#tabs").tabs( "refresh" );
    });
    
    // opens tabs for queue list items on double click
    $(document).on('dblclick', '#queueList li', function(){
        newTab();
    });
    
    // button handling    
    // resolve ticket button
    $("#tabs").button().on('click', '#resolve_ticket', function() {
        var panelId = $('span.ui-icon.ui-icon-close').closest("li").remove().attr( "aria-controls" );
        console.log(panelId);
        $( "#" + panelId ).remove();
        tabsOpen--; // max tabs tracker
        tabIndex--; // active tabs tracker
        $("#tabs").tabs( "refresh" )
    });
    
    // invite others button
    $("#tabs").button().on('click', '#invite_others', function() {
        $( "#dialogInvite" ).append(inviteOthersHTML);
        $( "#dialogInvite" ).dialog({modal: true, title: "Search For Support User", 
                                buttons: {
                                    'OK': function () {
                                        var name = $('input[name="name"]').val();
                                        $(this).dialog('close');
                                    }
                                }, height: 300, width: 360,
                                close: function() {
                                    $( this ).empty();
                                    $( this ).dialog('destroy');
                                }});
    });
    
    // view user's chat history (placeholder - not yet implemented)
    $("#tabs").button().on('click', '#user_history', function() {
        $( "#dialogUserHistory" ).dialog({modal: true, title: "User's Chat History", 
                                buttons: {
                                    'OK': function () {
                                        $(this).dialog('close');
                                    }
                                }});
    });
    
    // account settings
    $("#account_settings").button().on('click', function() {
        $("#dialogPane").append(accountSettingsHTML);

        $("#username").attr('placeholder', "new nickname");
        $("#pwd").attr('placeholder', "********");
        $("#color").attr('placeholder', "#ffffff");

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
    
    // logout
    
// ---------------------------------------------------------------------------------------- //
    if ( Cookies.getJSON('profile') ) {
        myName = Cookies.getJSON('profile').username;
        myColor = Cookies.getJSON('profile').color;
    }


    socket.on('connect', function (data) {
        socket.emit('connectRequest', Cookies.getJSON('profile'));
    });
    
    socket.on('message', function (data) {
        console.log(data);
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
            namespace: myNamespace,
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
        if (data.color) {
            myColor = data.color;
        }
        if (data.username) {
            myName = data.username;
        }
        if (data.namespace) {
            myNamespace = data.namespace;
        }
        if (data.userList) {
            clearUserList();
            for ( let user of data.userList ) {
                $('#userList').append($('<li>').html('<b><font color="' + user.color + '">' + user.username + '</font></b>'));
            }
        }
        if (data.chatHistory) {
            clearChatHistory();
            for ( let entry of data.chatHistory ) {
                if ( entry.serverMessage ) {
                    entry.username = 'Server';
                    entry.color = "red";
                    // made this queueList instead of messageList for testing purposes, pls revert
                    $('#queueList').append($('<li>').css('color', "red").html(buildMessageString(entry)));
                } else {
                    $('#queueList').append($('<li>').html(buildMessageString(entry)));
                }
            }
            //$('#messageList').scrollTop($('#messageList')[0].scrollHeight);
        }
        if (data.message) {
            data.username = 'Server';
            data.color = "red";
            $('#messageList').append($('<li>').css('color', "red").html(buildMessageString(data)));
                if ( $('#messageList').scrollTop() >= ( $('#messageList')[0] - $('#messageList').height() - 100 ) ) {
                    $('#messageList').scrollTop($('#messageList')[0].scrollHeight);
                }
		    }
		    Cookies.set('profile', {
                username: myName,
                color: myColor,
                namespace: myNamespace
            });
	  };
});

var inviteOthersHTML = '<div id="dialogContent"><div id="resultDialog"></div><form><fieldset><p class="validateTips">Invite another staff member to chat</p><label for="username">Staff Username: </label><input type="text" name="username" id="username" class="text ui-widget-content ui-corner-all" size="20" maxlength="15"><br></fieldset></form></div>';
var accountSettingsHTML = '<div id="dialogContent"><div id="resultDialog"></div><form><fieldset><p class="validateTips">Please enter your info.</p><label for="username">Display Name: </label><input type="text" name="username" id="username" class="text ui-widget-content ui-corner-all" size="20" maxlength="15"><br><label for="pwd">Password: </label><input type="password" name="pwd" id="pwd" class="text ui-widget-content ui-corner-all" size="25" maxlength="20"><br><label for="color">Color: </label><br><input type="text" name="color" id="color" class="text ui-widget-content ui-corner-all" size="25" maxlength="7"></br></fieldset></form></div>';

modifyAccountSettings = function() {
        if ( $("#username").val().trim().length < 3) {
            $("#username").addClass( "ui-state-error" );
            $(".validateTips").text("Your display name must be at least 3 characters.").addClass( "ui-state-highlight" );
            setTimeout(function() {
                $(".validateTips").removeClass( "ui-state-highlight", 1500 );
            }, 250 );
            return false;            
        }

        if( /[\W]/.test($("#username").val().slice(0, -1)) ) {
            $("#username").addClass( "ui-state-error" );
            $(".validateTips").text("Your username must contain only alphanumeric characters.").addClass( "ui-state-highlight" );
            setTimeout(function() {
                $(".validateTips").removeClass( "ui-state-highlight", 1500 );
            }, 250 );
            return false;
        }

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
            username: $("#username").val(),
            pwd: $("#pwd").val(),
            color: newColor
        });
    };