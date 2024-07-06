import http from 'k6/http';
import {check, group} from 'k6';
import {SharedArray} from 'k6/data';
import {randomItem} from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const BASE_URL = 'http://webtours.load-test.ru:1080/cgi-bin';

const data = new SharedArray('Get User Credentials', function () {
    const file = JSON.parse(open('./users.json'));
    return file.users;
});

let cookie = ""
let sessionValue = "";
let departureCity = "";
let arrivalCity = "";
let payloadFlightData = {}

export const options = {
    iterations: 1,
};

export function getSessionFromRootPage() {
    const welcomeResult = http.get(BASE_URL + '/welcome.pl?signOff=true');
    check(
        welcomeResult,
        {'Open Welcome Page | status_code is 200': (res) => res.status === 200}
    );
    cookie = welcomeResult.headers["Set-Cookie"]

    const headers = {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookie
        }
    };
    const getSessionResult = http.get(BASE_URL + '/nav.pl?in=home', headers);
    check(
        getSessionResult,
        {'Get session | status_code is 200': (res) => res.status === 200}
    );
    sessionValue = getSessionResult.html().find('input[name=userSession]').first().attr('value');
}

export function login() {
    const credentials = data[0]
    const payload = {
        userSession: sessionValue,
        username: credentials.username,
        password: credentials.password,
    };
    const loginPostResult = http.post(BASE_URL + '/login.pl', payload, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookie
        }
    });
    check(
        loginPostResult,
        {
            'Login with credentials | status_code is 200': (res) => res.status === 200,
            'Got correct title': loginPostResult.html().find('head title').text() === 'Web Tours'
        }
    );
    cookie = loginPostResult.headers["Set-Cookie"]

    const headers = {
        headers: {
            'Cookie': cookie
        }
    };
    const homeNavigationPageResult = http.get(BASE_URL + '/nav.pl?page=menu&in=home', headers);
    check(
        homeNavigationPageResult,
        {
            'Open Home Navigation Page | status_code is 200': (res) => res.status === 200,
            'Got correct navigation title': homeNavigationPageResult.html().find('head title').text() === 'Web Tours Navigation Bar'
        }
    );

    const loginGetResult = http.get(BASE_URL + '/login.pl?intro=true', headers);
    check(
        loginGetResult,
        {
            'Get Login Request | status_code is 200': (res) => res.status === 200,
            'Got correct welcome title': loginGetResult.html().find('head title').text() === 'Welcome to Web Tours'
        }
    );
}

export function chooseDirection() {
    const headers = {
        headers: {
            'Cookie': cookie,
            'Pragma': 'no-cache'
        }
    };
    const searchPageResult = http.get(BASE_URL + '/welcome.pl?page=search', headers);
    check(
        searchPageResult,
        {'Open Find Flight Page | status_code is 200': (res) => res.status === 200}
    );

    const flightNavigationPageResult = http.get(BASE_URL + '/nav.pl?page=menu&in=flights', headers);
    check(
        flightNavigationPageResult,
        {'Open Flight Navigation Page | status_code is 200': (res) => res.status === 200}
    );

    const welcomeReservationsPageResult = http.get(BASE_URL + '/reservations.pl?page=welcome', headers);
    check(
        welcomeReservationsPageResult,
        {'Get reservation data | status_code is 200': (res) => res.status === 200}
    );

    // Получаем список городов отправления и выбираем город отправления
    const doc = welcomeReservationsPageResult.html();
    let departureCities = []
    doc.find('table select[name=depart] option')
        .toArray()
        .forEach(function (item) {
            departureCities.push(item.val());
        });
    departureCity = randomItem(departureCities);

    // Получаем список городов прибытия и выбираем город прибытия, отличный от города отправления
    let arrivalCities = []
    doc.find('table select[name=arrive] option')
        .toArray()
        .forEach(function (item) {
            arrivalCities.push(item.val());
        });
    arrivalCity = randomItem(arrivalCities.filter((item) => item !== departureCity));

    // Заполняем данные о полете для POST-запроса
    payloadFlightData["advanceDiscount"] = doc.find('input[name=advanceDiscount]').val();
    payloadFlightData["depart"] = departureCity;
    payloadFlightData["departDate"] = doc.find('input[name=departDate]').val();
    payloadFlightData["arrive"] = arrivalCity;
    payloadFlightData["returnDate"] = doc.find('input[name=returnDate]').val();
    payloadFlightData["numPassengers"] = doc.find('input[name=numPassengers]').val();
    payloadFlightData["seatPref"] = doc.find('input[name=seatPref][checked=checked]').val();
    payloadFlightData["seatType"] = doc.find('input[name=seatType][checked=checked]').val();
    payloadFlightData["findFlights.x"] = 46;
    payloadFlightData["findFlights.y"] = 2;
}

export function findFlight() {
    const headers = {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': 'http://webtours.load-test.ru:1080/cgi-bin/reservations.pl?page=welcome',
            'Cookie': cookie,
            'Pragma': 'no-cache'
        }
    };
    const flightReservationsResult = http.post(
        BASE_URL + '/reservations.pl',
        payloadFlightData,
        headers
    );
    check(
        flightReservationsResult,
        {
            'Find flight reservation data | status_code is 200': (res) => res.status === 200,
            'Got correct title': flightReservationsResult.html().find('head title').text() === 'Flight Selections'
        }
    );

    // Получаем список рейсов по данному направлению
    let flights = []
    flightReservationsResult.html().find('input[name=outboundFlight]')
        .toArray()
        .forEach(function (item) {
            console.log(item.val())
            flights.push(item.val());
        });
    console.log(flights)
    // const selectedFlight = randomItem(flights);
    // console.log(selectedFlight)
    // flightReservationsResult.html().find('input[name=outboundFlight]')
    //     .toArray()
    //     .forEach(function (item) {
    //         console.log(item.val())
    //     });


    // const smth = flightReservationsResult.html().find('input[name=outboundFlight]').val();
    // console.log(smth)
}

export default function () {
    group('getSession', () => {
        getSessionFromRootPage();
    });
    group('login', () => {
        login();
    });
    group('chooseDirection', () => {
        chooseDirection();
    });
    group('findFlight', () => {
        findFlight();
    });
}