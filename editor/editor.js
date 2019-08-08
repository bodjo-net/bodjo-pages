let SERVER_IP = null;
GET('https://bodjo.net/SERVER_IP', (status, data) => {
	if (status) {
		SERVER_IP = data;
		console.log("Got main server IP: " + SERVER_IP);

		onload();
	}
});

// cookies (thanks to https://learn.javascript.ru/cookie)
function getCookie(name) {
  let matches = document.cookie.match(new RegExp(
    "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
  ));
  return matches ? decodeURIComponent(matches[1]) : undefined;
}
function setCookie(name, value, options) {
  options = {
    path: '/',
    ...options
  }

  let updatedCookie = encodeURIComponent(name) + "=" + encodeURIComponent(value);

  for (let optionKey in options) {
    updatedCookie += "; " + optionKey;
    let optionValue = options[optionKey];
    if (optionValue !== true)
      updatedCookie += "=" + optionValue;
  }

  document.cookie = updatedCookie;
}

let tokenData = null;
let auth = document.querySelector('#auth');
let usernameInput = auth.querySelector("#username");
let passwordInput = auth.querySelector("#password");
usernameInput.addEventListener('change', credentialsChange);
passwordInput.addEventListener('change', credentialsChange);
function credentialsChange() {
	let usernameValue = usernameInput.value;
	let passwordValue = /^\*+$/g.test(passwordInput.value) ? JSON.parse(localStorage['bodjo-password']) : passwordInput.value;
	GET(SERVER_IP + '/account/login?username=' + usernameValue + '&password=' + encodeURIComponent(passwordValue), (status, data) => {
		if (usernameValue != usernameInput.value ||
			(!/^\*+$/g.test(passwordInput.value) && passwordValue != passwordInput.value)) {
			auth.className = '';
			return;
		}
		if (status && data.status == 'ok') {
			tokenData = data.token;
			localStorage.setItem('bodjo-token', JSON.stringify(tokenData.value));
			setCookie('bodjo-token', JSON.stringify(tokenData.value), {domain: 'bodjo.net'});
			auth.className = 'verified';
		} else {
			auth.className = '';
		}

		localStorage.setItem('bodjo-username', JSON.stringify(usernameValue));
		localStorage.setItem('bodjo-password', JSON.stringify(passwordValue));
	})
}
function onload() {
	if (localStorage['bodjo-username'])
		usernameInput.value = JSON.parse(localStorage['bodjo-username']);
	if (localStorage['bodjo-password'])
		passwordInput.value = '*'.repeat(100);
	credentialsChange();

	if (location.hash) {
		let hash = location.hash;
		if (hash[0] == '#')
			hash = hash.substring(1);
		idInput.value = hash;
		onPageIDChange();
	}
}

function GET(url, callback) {
	let xhr = new XMLHttpRequest();
	if (url.indexOf('http://')!=0&&url.indexOf('https://')!=0)
		url = 'http://'+url;
	xhr.open('GET', url, true);
	xhr.send();
	xhr.onreadystatechange = function () {
		if (xhr.readyState !== 4) return;

		if (xhr.status == 200) {
			let data = xhr.responseText;
			try {
				data = JSON.parse(data);
			} catch (e) {}
			callback(true, data);
		} else {
			callback(false, xhr);
		}

	}
}
function POST(url, before, callback) {
	let xhr = new XMLHttpRequest();
	if (url.indexOf('http://')!=0&&url.indexOf('https://')!=0)
		url = 'http://'+url;
	xhr.open('POST', url, true);
	before(xhr);
	xhr.onreadystatechange = function () {
		if (xhr.readyState !== 4) return;

		if (xhr.status == 200) {
			let data = xhr.responseText;
			try {
				data = JSON.parse(data);
			} catch (e) {}
			callback(true, data);
		} else {
			callback(false, xhr);
		}

	}
}

let textarea = document.querySelector('#editor textarea');
let idInput = document.querySelector("#editor #page-id");
let preview = document.querySelector("#editor #preview");
let count = document.querySelector("#count");
let submit = document.querySelector("#editor #submit");
let remove = document.querySelector("#editor #remove");

textarea.addEventListener('change', onChange);
textarea.addEventListener('keyup', onChange);
function onChange() {
	preview.innerHTML = parse(textarea.value);
	count.innerText = textarea.value.length;
	count.style.paddingRight = (textarea.scrollHeight > textarea.clientHeight ? "25px" : "5px")
}
onChange();

textarea.addEventListener('keydown', function(e) {
  var keyCode = e.keyCode || e.which;

  if (keyCode == 9) {
    e.preventDefault();
    var start = this.selectionStart;
    var end = this.selectionEnd;

    textarea.value = textarea.value.substring(0, start)
                + "\t"
                + textarea.value.substring(end);

    this.selectionStart =
    this.selectionEnd = start + 1;
  }
});

let exists = false;
idInput.addEventListener('change', onPageIDChange);
idInput.addEventListener('keyup', () => window.location.hash = "#" + idInput.value)
function onPageIDChange() {
	let pageId = idInput.value;
	exists = false;
	updateSubmitButton();
	GET(SERVER_IP + '/pages/load?id=' + pageId, (status, data) => {
		if (status && data.status == 'ok') {
			if (data.page.id != pageId) {
				exists = false;
			} else {
				textarea.value = data.page.content;
				onChange();
				exists = true;
			}
			updateSubmitButton();
		}
	});
}
function updateSubmitButton() {
	submit.innerText = exists ? 'EDIT' : 'PUBLISH';
}


let fontSize = 15;
window.addEventListener('keydown', function (e) {
	if ((e.keyCode == 187 || e.keyCode == 189) && (e.metaKey || e.altKey)) {
		fontSize += 2*(e.keyCode==187?1:-1);
		if (fontSize < 5) fontSize = 5;
		if (fontSize > 50) fontSize = 50;
		textarea.style.fontSize = fontSize + 'px';
	}
});
textarea.style.fontSize = fontSize + 'px';

function parse(string) {
	string = string.replace(/\</g, '&lt;');
	string = string.replace(/\>/g, '&gt;');

	string = string.replace(/\`\`\`(?:\n|\r\n){0,1}((\n|[^`])+)\`\`\`/gm, function (full, content) {
		return ("<pre class='code'>" + 
			content.replace(/\#/g, '&#35;')
				.replace(/\!/g, '&#33;')
				.replace(/\?/g, '&#63;')
				.replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
				.replace(/ /g, '&nbsp;')
		 + "</pre>");
	});
	string = string.replace(/\`([^`]+)\`/g, "<span class='code-small'>$1</span>");

	string = string.replace(/^(\#{1,6}) (.+)$/gm, function (full, hashtags, content) {
		return '<h' + hashtags.length + '>'+content+'</h'+hashtags.length+'>';
	});

	string = string.replace(/^(\?|\!) {0,1}\{(?:\n|\r\n){0,1}([^\}]+)(?:\n|\r\n){0,1}\}/gm, function (full, sign, content) {
		return '<div class="'+({'?':'question','!':'warning'})[sign]+'"><span>'+sign+'</span>'+content+'</div>';
	});

	string = string.replace(/((?:^(?:[ \t]*)(?:\-|\d+\.|\w+\.) (?:[^\n\r]+)\n{0,1}){1,})/gm, function (full) {
		return "<ul>" + full.replace(/^([ \t]*)(\-|\d+\.|\w+\.) (.+)(?:\n|\r\n){0,1}/gm, function (full, tabs, marker, content) {
			let style = "", t = (tabs.match(/\t/g)||[]).length;
			if (/^[ixv]+\.$/.test(marker)) {
				style = "list-style: lower-roman;";
			} else if (/^[IXV]+\.$/.test(marker)) {
				style = "list-style: upper-roman;";
			} else if (/^\d+\.$/.test(marker) || /^\w+\.$/.test(marker)) {
				style = 'list-style: none;';
				content = marker + " " + content;
			} else if (t >= 0)
				style = "list-style: "+(['disc','circle','square'])[t%3]+';';
			if (t > 0)
				style += "margin-left: " + t + "em;";
			return "<li style='"+style+"'>"+content+"</li>";
		})+"</ul>";
	});

	string = string.replace(/\!\[([^\]]*)\]\(([^\)]+)\)/g, "<img src='$2' alt='$1'></img>");
	string = string.replace(/(?:\n|\r\n){0,1}\&gt\;\[([^\]]*)\]\(([^\)]+)\)(?:\n|\r\n){0,1}/g, "<img src='$2' class='right' alt='$1'></img>");
	string = string.replace(/(?:\n|\r\n){0,1}\&lt\;\[([^\]]*)\]\(([^\)]+)\)(?:\n|\r\n){0,1}/g, "<img src='$2' class='left' alt='$1'></img>");
	string = string.replace(/\[([^\]]*)\]\(([^\)]+)\)/g, "<a href='$2'>$1</a>");

	string = string.replace(/__([^_]+)__/g, "<i>$1</i>");
	string = string.replace(/\*\*([^\*]+)\*\*/g, "<b>$1</b>");

	string = string.replace(/(?:\n|\r\n)/g, '<br>');
	return string;
}

function upload() {
	if (tokenData == null) {
		alert('login first');
		return;
	}

	POST(SERVER_IP + "/pages/" + (exists ? 'edit' : 'publish') + "?id=" + idInput.value + "&token=" + tokenData.value, (req) => {
		req.setRequestHeader('Content-Type', 'plain/text');
		req.send(textarea.value);
	}, (status, data) => {
		if (status && data.status == 'ok') {
			alert('success');
			if (!exists) {
				exists = true;
				updateSubmitButton();
			}
		} else {
			if (!status) {
				alert('bad http response: ' + data.statusCode + " - " + data.statusText);
			} else if (data.status != 'ok') {
				alert('bad api response: ' + JSON.stringify(data, null, '\t'));
			}
		}
	});
}
submit.addEventListener('click', upload);

function removePage() {

	if (tokenData == null) {
		alert('login first');
		return;
	}

	GET(SERVER_IP + "/pages/remove?id=" + idInput.value + "&token=" + tokenData.value,
		(status, data) => {
		if (status && data.status == 'ok') {
			alert('success');
			if (exists) {
				exists = false;
				updateSubmitButton();
			}
		} else {
			if (!status) {
				alert('bad http response: ' + data.statusCode + " - " + data.statusText);
			} else if (data.status != 'ok') {
				alert('bad api response: ' + JSON.stringify(data, null, '\t'));
			}
		}
	});
}
remove.addEventListener('click', removePage);