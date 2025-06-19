from django import forms

class LoginForm(forms.Form):
    login_number = forms.CharField(label='ログイン番号', 
                                   max_length=10,
                                   widget=forms.TextInput(attrs={'placeholder': '従業員番号',
                                                                 'class': 'sign-in-input'}))
class CardForm(forms.Form):
    OPTIONS = (
        ('OK', 'OK'),
        ('NG', 'NG'),
    )
    options = forms.ChoiceField(choices=OPTIONS, widget=forms.RadioSelect)
    issueDetails = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={
            'id' : 'issueDetails',
            'class': 'base-font-size',
            'placeholder': ' ',
        }),
        label='実施内容・指摘事項'
    )
    
    manhours = forms.TypedChoiceField(
        coerce=int,
        choices=[(i, i) for i in range(5, 505, 5)],
        label='工数',
        widget=forms.Select(attrs={
            'id': 'selected-manhours',
            'class': 'selected-item base-font-size'
        })
    )
    
    comment = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={
            'id' : 'comment',
            'class': 'base-font-size',
            'placeholder': ' ',
        }),
        label='コメント'
    )