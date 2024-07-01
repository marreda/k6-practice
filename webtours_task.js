import http from 'k6/http';
import {check, group} from 'k6';
import {SharedArray} from 'k6/data';
import {randomItem} from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const BASE_URL = 'http://webtours.load-test.ru:1080/cgi-bin';

const credentials = new SharedArray('Get User Credentials', function () {
    const file = JSON.parse(open('./users.json'));
    return file.users;
});

let sessionValue = "";
let departureCity = "";
let arrivalCity = "";

export const options = {
    iterations: 1,
};

export function getSessionFromRootPage() {
    const welcomeResult = http.get(BASE_URL + '/welcome.pl?signOff=true');
    check(
        welcomeResult,
        {'Open Welcome Page | status_code is 200': (res) => res.status === 200}
    );

    const getSessionResult = http.get(BASE_URL + '/nav.pl?in=home');
    check(
        getSessionResult,
        {'Get session | status_code is 200': (res) => res.status === 200}
    );
    sessionValue = getSessionResult.html().find('input[name=userSession]').first().attr('value');
}

export function login() {
    const headers = {headers: {'Content-Type': 'application/x-www-form-urlencoded'}};
    const payload = {
        userSession: sessionValue,
        username: credentials.username,
        password: credentials.password,
    };
    const loginPostResult = http.post(
        BASE_URL + '/login.pl?intro=true',
        JSON.stringify(payload),
        headers
    );
    check(
        loginPostResult,
        {'Login with credentials | status_code is 200': (res) => res.status === 200}
    );

    const homeNavigationPageResult = http.get(BASE_URL + '/nav.pl?page=menu&in=home');
    check(
        homeNavigationPageResult,
        {
            'Open Home Navigation Page | status_code is 200': (res) => res.status === 200,
            'Got correct title': homeNavigationPageResult.html().find('head title').text() === 'Web Tours Navigation Bar'
        }
    );

    const loginGetResult = http.get(BASE_URL + '/login.pl?intro=true');
    check(
        loginGetResult,
        {
            'Get Login Request | status_code is 200': (res) => res.status === 200,
            'Got correct welcome title': loginGetResult.html().find('head title').text() === 'Welcome to Web Tours'
        }
    );
}

export function findFlight() {
    const searchPageResult = http.get(BASE_URL + '/welcome.pl?page=search');
    check(
        searchPageResult,
        {'Open Find Flight Page | status_code is 200': (res) => res.status === 200}
    );

    const flightNavigationPageResult = http.get(BASE_URL + '/nav.pl?page=menu&in=flights');
    check(
        flightNavigationPageResult,
        {'Open Flight Navigation Page | status_code is 200': (res) => res.status === 200}
    );

    const welcomeReservationsPageResult = http.get(BASE_URL + '/reservations.pl?page=welcome');
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
}

export default function () {
    group('getSession', () => {
        getSessionFromRootPage();
    });
    group('login', () => {
        login();
    });
    group('findFlight', () => {
        findFlight();
    });
}