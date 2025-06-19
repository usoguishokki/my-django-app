export function asynchronousCommunication(options) {
    const headers = {
        'X-Requested-With': 'XMLHttpRequest',
        //'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
    };

    //GETリクエストの場合はContent-Typeを設定しない
    if (options.method !== 'GET') {
        headers['Content-Type'] = 'application/json';

        //追加
        headers['X-CSRFToken'] = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
    }

    return fetch(options.url, {
        method: options.method,
        headers: headers,
        body: options.method !== 'GET' ? JSON.stringify(options.data) : null //GETリクエストの場合はbodyを送信しない
    })
    .then(response => {
        return response.text().then(text => {
            try {
                const data = JSON.parse(text);
                if (!response.ok) {
                    throw new Error(data.message || 'Network response was not ok');
                }
                if (data.status != 'success') {
                    alert('There was a problem fetching data:' + data.message);
                    throw new Error(data.message || 'Data fetch was not successful');
                }
                return data
            } catch (error) {
                console.error('Error parsing JSON:', text);
                throw new Error('Response was not valid JSON: ' + text);
            }
        });
    })
    .catch(error => {
        alert('There was problem with fetch operation:' + error.message);
        console.log('Fetch error:', error);
    });
}