from django import forms

class LoginForm(forms.Form):
    login_number = forms.CharField(label='ログイン番号', 
                                   max_length=10,
                                   widget=forms.TextInput(attrs={'placeholder': '従業員番号',
                                                                 'class': 'sign-in-input'}))
