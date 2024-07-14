import http from 'k6/http';
import {check} from 'k6';

export const options = {
    discardResponseBodies: true,
    scenarios: {
        yandex: {
            exec: 'openYaRu',
            executor: 'ramping-arrival-rate',
            preAllocatedVUs: 50,
            startRate: 0,
            timeUnit: '1m', // per minute
            stages: [
                {target: 60, duration: '5m'},
                {target: 60, duration: '10m'}, // 100% ya.ru
                {target: 72, duration: '5m'},
                {target: 72, duration: '10m'}, // 120% ya.ru
            ],
        },
        www: {
            exec: 'openWwwRu',
            executor: 'ramping-arrival-rate',
            preAllocatedVUs: 50,
            startRate: 0,
            timeUnit: '1m', // per minute
            stages: [
                {target: 120, duration: '5m'},
                {target: 120, duration: '10m'}, // 100% www.ru
                {target: 144, duration: '5m'},
                {target: 144, duration: '10m'}, // 120% www.ru
            ],
        },
    }
};

export function openYaRu() {
    const yaResult = http.get('https://ya.ru/');
    check(
        yaResult,
        {'Open ya.ru | status_code is 200': (res) => res.status === 200}
    );
}

export function openWwwRu() {
    const wwwResult = http.get('http://www.ru/');
    check(
        wwwResult,
        {'Open www.ru | status_code is 200': (res) => res.status === 200}
    );
}